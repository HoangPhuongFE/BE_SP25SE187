import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load .env ngay đầu file
dotenv.config();



const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});


export const sendEmail = async (
  recipientEmail: string,
  subject: string,
  content: string, // HTML content
  attachment?: string
) => {
  const mailOptions: nodemailer.SendMailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject,
    html: content, //  Đây là dòng quan trọng cần sửa
  };

  if (attachment) {
    mailOptions.attachments = [{ path: attachment }];
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${recipientEmail}`);
    return true;
  } catch (error) {
    console.error(`Error sending email to ${recipientEmail}:`, error);
    throw error;
  }
};
