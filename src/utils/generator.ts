export const generateUsername = (email: string): string => {
  // Lấy phần trước @ của email
  const username = email.split('@')[0];
  
  // Loại bỏ các ký tự đặc biệt
  return username.replace(/[^a-zA-Z0-9]/g, '');
}; 