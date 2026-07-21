const prisma = require('../config/db');
const { getCache, setCache } = require('../utils/redisHelper');

const getDashboardStats = async (req, res) => {
  {
    const { system = 'FAI', year, week, refresh } = req.query;

    if (system === 'FAI' && (!req.user.permissions || !req.user.permissions.includes('VIEW_DASHBOARD_FAI'))) {
      return res.status(403).json({ error: 'Access denied. VIEW_DASHBOARD_FAI permission required.' });
    }
    if (system === 'LAB' && (!req.user.permissions || !req.user.permissions.includes('VIEW_DASHBOARD_LAB'))) {
      return res.status(403).json({ error: 'Access denied. VIEW_DASHBOARD_LAB permission required.' });
    }

    // Normalize and sort parameters for consistent cache keys
    const sortedYear = year ? year.split(',').map(y => y.trim()).sort().join(',') : 'all';
    const sortedWeek = week ? week.split(',').map(w => w.trim()).sort().join(',') : 'all';

    const cacheKey = `dashboard:stats:${system}:${sortedYear}:${sortedWeek}`;

    // Bypass cache if refresh is requested
    if (refresh !== 'true') {
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    if (system === 'FAI') {
      const whereClause = {
        is_active: true,
        status: { not: 'Draft' }
      };

      // Apply Year filter using created_at
      if (year) {
        const yearsArray = year.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
        if (yearsArray.length > 0) {
          whereClause.OR = yearsArray.map(y => ({
            created_at: {
              gte: new Date(`${y}-01-01T00:00:00.000Z`),
              lt: new Date(`${y + 1}-01-01T00:00:00.000Z`)
            }
          }));
        }
      }

      // Apply Week filter
      if (week) {
        const weeksArray = week.split(',').map(w => parseInt(w.trim())).filter(w => !isNaN(w));
        if (weeksArray.length > 0) {
          whereClause.week_no = { in: weeksArray };
        }
      }

      // Parallel queries for speed
      const [
        totalRequests,
        statusGroups,
        resultGroups,
        commodityCounts,
        commodityFailCounts,
        weeklyData
      ] = await Promise.all([
        prisma.faiRequest.count({ where: whereClause }),
        
        prisma.faiRequest.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { status: true }
        }),

        prisma.faiRequest.groupBy({
          by: ['result'],
          where: whereClause,
          _count: { result: true }
        }),

        prisma.faiRequest.groupBy({
          by: ['commodity_part'],
          where: whereClause,
          _count: { commodity_part: true }
        }),

        prisma.faiRequest.groupBy({
          by: ['commodity_part'],
          where: { ...whereClause, result: 'Fail' },
          _count: { commodity_part: true }
        }),

        prisma.faiRequest.groupBy({
          by: ['week_no', 'status', 'result'],
          where: whereClause,
          _count: { id: true }
        })
      ]);

      // Process KPIs
      let closed = 0, ongoing = 0, backlogAssigned = 0;
      statusGroups.forEach(g => {
        if (g.status === 'Closed') closed += g._count.status;
        else if (g.status === 'Ongoing' || g.status === 'Evaluating') ongoing += g._count.status;
        else if (g.status === 'Backlog' || g.status === 'Assigned') backlogAssigned += g._count.status;
      });

      let pass = 0, fail = 0;
      resultGroups.forEach(g => {
        if (g.result === 'Pass') pass += g._count.result;
        else if (g.result === 'Fail') fail += g._count.result;
      });

      const passRate = (pass + fail) > 0 ? ((pass / (pass + fail)) * 100).toFixed(1) : 0;

      // For commodities, we need their names. We'll fetch them efficiently
      const commodityIds = commodityCounts.map(c => c.commodity_part).filter(id => id !== null);
      const commodities = await prisma.commodityPart.findMany({
        where: { id: { in: commodityIds } },
        select: { id: true, name: true }
      });
      
      const commMap = Object.fromEntries(commodities.map(c => [c.id, c.name]));

      const mappedCommodityCounts = commodityCounts.map(c => ({
        name: c.commodity_part ? commMap[c.commodity_part] : 'Unknown',
        count: c._count.commodity_part
      })).sort((a, b) => b.count - a.count);

      const mappedCommodityFailCounts = commodityFailCounts.map(c => ({
        name: c.commodity_part ? commMap[c.commodity_part] : 'Unknown',
        count: c._count.commodity_part
      })).sort((a, b) => b.count - a.count);

      const currentYearForWeek = year ? parseInt(year.split(',')[0]) : new Date().getFullYear();
      const numWeeks = 53;
      const weeklyYieldMap = {};
      
      for (let i = 1; i <= numWeeks; i++) {
        const wStr = `WW${i.toString().padStart(2, '0')}`;
        weeklyYieldMap[i] = {
          week: wStr,
          received: 0,
          inspection: 0,
          failure: 0,
          pending: 0,
          pass: 0,
          passRate: '0.0'
        };
      }

      weeklyData.forEach(d => {
        const wObj = weeklyYieldMap[d.week_no];
        if (wObj) {
          const count = d._count.id;
          wObj.received += count;
          
          if (['Ongoing', 'Closed'].includes(d.status)) {
            wObj.inspection += count;
          }
          
          if (d.result === 'Fail') {
            wObj.failure += count;
          }
          if (d.result === 'Pass') {
            wObj.pass += count;
          }
        }
      });

      const weeklyYield = Object.values(weeklyYieldMap).map(w => {
        w.pending = w.received - w.inspection;
        w.passRate = (w.pass + w.failure) > 0 ? ((w.pass / (w.pass + w.failure)) * 100).toFixed(2) : '0.00';
        return w;
      });

      const payload = {
        kpi: {
          total: totalRequests,
          closed,
          ongoing,
          backlogAssigned,
          passRate: parseFloat(passRate)
        },
        charts: {
          status: { closed, ongoing, backlog: backlogAssigned },
          result: { pass, fail, tbd: totalRequests - pass - fail },
          commodity: mappedCommodityCounts,
          pareto: mappedCommodityFailCounts,
          weeklyYield
        }
      };

      // Cache for 10 minutes
      await setCache(cacheKey, payload, 600);

      return res.json(payload);
    } else if (system === 'LAB') {
      const whereClause = {
        is_active: true,
        status: { not: 'Draft' }
      };

      if (year) {
        const yearsArray = year.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
        if (yearsArray.length > 0) {
          whereClause.OR = yearsArray.map(y => ({
            created_at: {
              gte: new Date(`${y}-01-01T00:00:00.000Z`),
              lt: new Date(`${y + 1}-01-01T00:00:00.000Z`)
            }
          }));
        }
      }

      if (week) {
        const weeksArray = week.split(',').map(w => parseInt(w.trim())).filter(w => !isNaN(w));
        if (weeksArray.length > 0) {
          whereClause.week_no = { in: weeksArray };
        }
      }

      const [totalRequests, statusGroups, workOrders] = await Promise.all([
        prisma.labRequest.count({ where: whereClause }),
        prisma.labRequest.groupBy({
          by: ['status'],
          where: whereClause,
          _count: { status: true }
        }),
        prisma.labWorkOrder.findMany({
          where: {
            is_active: true,
            labRequest: whereClause
          },
          include: {
            itemTest: {
              select: { name: true }
            }
          }
        })
      ]);

      let closed = 0, ongoing = 0, backlogAssigned = 0;
      statusGroups.forEach(g => {
        if (g.status === 'Closed') closed += g._count.status;
        else if (g.status === 'Ongoing') ongoing += g._count.status;
        else if (g.status === 'Backlog' || g.status === 'Assigned') backlogAssigned += g._count.status;
      });

      let pass = 0, fail = 0, tbd = 0;
      const testTypeCounts = {};
      const dateMap = {}; // date -> { itemTestName -> count }
      const itemTestNames = new Set();

      workOrders.forEach(wo => {
        const resVal = (wo.test_result || '').toUpperCase();
        if (resVal === 'PASS') pass++;
        else if (resVal === 'FAIL') fail++;
        else tbd++;

        const name = wo.itemTest?.name || 'Unknown';
        testTypeCounts[name] = (testTypeCounts[name] || 0) + 1;

        const dateStr = wo.created_at.toISOString().split('T')[0];
        itemTestNames.add(name);
        if (!dateMap[dateStr]) dateMap[dateStr] = {};
        dateMap[dateStr][name] = (dateMap[dateStr][name] || 0) + 1;
      });

      const testType = Object.entries(testTypeCounts).map(([name, count]) => ({
        name,
        count
      })).sort((a, b) => b.count - a.count);

      const sortedDates = Object.keys(dateMap).sort();
      const monthGroups = {};
      sortedDates.forEach((dStr, index) => {
        const date = new Date(dStr);
        const yearMonth = `${date.getFullYear()}-${date.getMonth()}`;
        if (!monthGroups[yearMonth]) {
          monthGroups[yearMonth] = [];
        }
        monthGroups[yearMonth].push(index);
      });

      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const labels = sortedDates.map((dStr, index) => {
        const date = new Date(dStr);
        const day = date.getDate().toString();
        const yearMonth = `${date.getFullYear()}-${date.getMonth()}`;
        const indices = monthGroups[yearMonth];
        const middleIndex = indices[Math.floor(indices.length / 2)];
        return [day, ''];
      });

      const datasets = Array.from(itemTestNames).map(name => {
        const data = sortedDates.map(dStr => dateMap[dStr][name] || 0);
        return {
          label: name,
          data
        };
      });

      const payload = {
        kpi: {
          total: totalRequests,
          closed,
          ongoing,
          backlogAssigned,
          passRate: (pass + fail) > 0 ? parseFloat(((pass / (pass + fail)) * 100).toFixed(1)) : 0
        },
        charts: {
          status: { closed, ongoing, backlog: backlogAssigned },
          result: { pass, fail, tbd },
          testType,
          itemTestByDate: { labels, datasets, rawDates: sortedDates }
        }
      };

      await setCache(cacheKey, payload, 600);

      return res.json(payload);
    }

    res.status(400).json({ error: 'Invalid system parameter' });
  }
};

module.exports = {
  getDashboardStats
};
