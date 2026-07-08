export function getContrastColor(hexColor: string): string {
  if (!hexColor) return '#ffffff';
  
  let hex = hexColor.replace('#', '');
  
  if (hex.length !== 6 && hex.length !== 3) return '#ffffff';
  
  let r = 0, g = 0, b = 0;
  
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }
  
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}
