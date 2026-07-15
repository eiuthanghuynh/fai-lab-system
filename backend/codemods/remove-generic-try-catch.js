module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let dirty = false;

  root.find(j.TryStatement).forEach(path => {
    // 1. Bỏ qua nếu có block `finally`
    if (path.node.finalizer) return;

    // 2. Bỏ qua nếu đây là Nested Try/Catch
    let parent = path.parent;
    let isNested = false;
    while (parent) {
      if (parent.node.type === 'TryStatement') {
        isNested = true;
        break;
      }
      parent = parent.parent;
    }
    if (isNested) return;

    const catchClause = path.node.handler;
    if (!catchClause) return;

    const catchBody = catchClause.body.body;
    // 3. Phải có ít nhất 1 lệnh và tối đa 2 lệnh
    if (catchBody.length === 0 || catchBody.length > 2) return;

    let responseStatement = catchBody.length === 2 ? catchBody[1] : catchBody[0];
    
    // Nếu có 2 lệnh, lệnh đầu phải là console.log/error/warn thuần tuý
    if (catchBody.length === 2) {
      const stmt0 = catchBody[0];
      if (
        stmt0.type !== 'ExpressionStatement' || 
        stmt0.expression.type !== 'CallExpression' ||
        stmt0.expression.callee.type !== 'MemberExpression' ||
        stmt0.expression.callee.object.name !== 'console'
      ) {
        return; 
      }
    }

    let isGeneric500 = false;
    let hasReturn = responseStatement.type === 'ReturnStatement';
    
    // Lấy biểu thức thực thi bên trong (có return hoặc không)
    const expr = hasReturn ? responseStatement.argument : responseStatement.expression;

    // 4. Match AST chính xác cho `xxx.status(500).json(...)` hoặc `xxx.sendStatus(500)`
    if (expr && expr.type === 'CallExpression' && expr.callee.type === 'MemberExpression') {
      const callee = expr.callee;
      const propName = callee.property.name;
      
      if (propName === 'json' || propName === 'send') {
        if (
          callee.object.type === 'CallExpression' && 
          callee.object.callee.type === 'MemberExpression' &&
          callee.object.callee.property.name === 'status' &&
          callee.object.arguments.length === 1 &&
          callee.object.arguments[0].value === 500
        ) {
          isGeneric500 = true;
        }
      } 
      else if (propName === 'status' || propName === 'sendStatus') {
        if (expr.arguments.length === 1 && expr.arguments[0].value === 500) {
          isGeneric500 = true;
        }
      }
    }

    if (!isGeneric500) return;

    // 5. Kiểm tra code tiếp diễn (Edge case Missing Return)
    if (!hasReturn) {
      const parentBody = path.parent.node.body;
      if (Array.isArray(parentBody)) {
        const tryIndex = parentBody.indexOf(path.node);
        // Nếu Try không phải lệnh cuối cùng của hàm, tháo try sẽ làm gãy luồng chạy
        if (tryIndex !== -1 && tryIndex < parentBody.length - 1) {
          return;
        }
      }
    }

    // 6. Tháo Try nhưng bọc lại bằng BlockStatement để bảo toàn Lexical Scope của let/const
    j(path).replaceWith(j.blockStatement(path.node.block.body));
    dirty = true;
  });

  return dirty ? root.toSource({ quote: 'single' }) : null;
};
