import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load biến môi trường từ .env
dotenv.config();

// Tạo transporter với cấu hình SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false, // Cổng 587 dùng STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false, // Bỏ qua lỗi chứng chỉ (tùy chọn)
  },
});

// Hàm gửi email
export const sendEmail = async (
  recipientEmail: string,
  subject: string,
  content: string,
  attachment?: string
): Promise<boolean> => {
  // Kiểm tra dữ liệu đầu vào
  if (!recipientEmail || !subject || !content) {
    const errorMsg = `Dữ liệu email không hợp lệ: to=${recipientEmail}, subject=${subject}, content=${content}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const mailOptions: nodemailer.SendMailOptions = {
    from: `"Hệ thống thông báo" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject,
    html: content, // Hỗ trợ HTML
  };

  if (attachment) {
    mailOptions.attachments = [{ path: attachment }];
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email đã gửi thành công tới ${recipientEmail}`);
    return true;
  } catch (error) {
    const errorMsg = `Lỗi gửi email tới ${recipientEmail}: ${(error as Error).message}`;
    console.error(errorMsg);
    throw new Error(errorMsg); // Ném lỗi để hàng đợi thử lại
  }
};

// Kiểm tra kết nối SMTP
export const verifyEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log("Kết nối SMTP thành công");
  } catch (error) {
    console.error("Lỗi kết nối SMTP:", (error as Error).message);
    throw error;
  }
};