import { v2 as cloudinary } from 'cloudinary';

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Export cloudinary với kiểu rõ ràng
export default cloudinary as typeof cloudinary & {
  uploader: {
    upload: (path: string, options?: any) => Promise<any>;
    // Thêm các phương thức khác của uploader nếu cần
  };
};