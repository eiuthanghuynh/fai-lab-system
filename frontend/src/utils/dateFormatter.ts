export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatDateOnly = (dateString: string | null | undefined): string => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
