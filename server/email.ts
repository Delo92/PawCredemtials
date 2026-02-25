import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "noreply@pawcredentials.com";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log("[email] SendGrid initialized");
} else {
  console.warn("[email] SENDGRID_API_KEY not set — emails will be logged but not sent");
}

interface DoctorEmailData {
  doctorEmail: string;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  packageName: string;
  formData: Record<string, any>;
  reviewUrl: string;
  applicationId: string;
}

interface AdminEmailData {
  adminEmail: string;
  doctorName: string;
  patientName: string;
  patientEmail: string;
  packageName: string;
  formData: Record<string, any>;
  reviewUrl: string;
  applicationId: string;
}

interface PatientApprovalEmailData {
  patientEmail: string;
  patientName: string;
  packageName: string;
  applicationId: string;
  dashboardUrl: string;
}

function formatFormData(formData: Record<string, any>): string {
  if (!formData || Object.keys(formData).length === 0) return "<p>No additional form data provided.</p>";
  const rows = Object.entries(formData)
    .filter(([key]) => !["packageId", "password", "confirmPassword", "ssn"].includes(key))
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
      return `<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">${label}</td><td style="padding:8px;border:1px solid #ddd;">${value || "N/A"}</td></tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>`;
}

export async function sendDoctorApprovalEmail(data: DoctorEmailData): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a365d;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">Paw Credentials</h1>
        <p style="margin:5px 0 0;">ESA Letter Review Request</p>
      </div>
      <div style="padding:20px;background:#f9fafb;">
        <h2>New Patient Review Required</h2>
        <p>Dear Dr. ${data.doctorName},</p>
        <p>A new ESA letter request has been submitted and requires your review.</p>
        <div style="background:white;padding:15px;border-radius:8px;margin:16px 0;">
          <h3 style="margin-top:0;">Patient Information</h3>
          <p><strong>Name:</strong> ${data.patientName}</p>
          <p><strong>Email:</strong> ${data.patientEmail}</p>
          <p><strong>Package:</strong> ${data.packageName}</p>
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
        </div>
        <h3>Submitted Details</h3>
        ${formatFormData(data.formData)}
        <div style="text-align:center;margin:30px 0;">
          <a href="${data.reviewUrl}" style="background:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
            Review &amp; Approve
          </a>
        </div>
        <p style="color:#666;font-size:12px;">This review link expires in 7 days. If you have questions, please contact the admin team.</p>
      </div>
    </div>
  `;

  if (!SENDGRID_API_KEY) {
    console.log(`[email] Would send doctor email to ${data.doctorEmail} for application ${data.applicationId}`);
    console.log(`[email] Review URL: ${data.reviewUrl}`);
    return true;
  }

  try {
    await sgMail.send({
      to: data.doctorEmail,
      from: SENDGRID_FROM_EMAIL,
      subject: `New ESA Letter Review: ${data.patientName} - ${data.packageName}`,
      html,
    });
    console.log(`Doctor approval email sent to ${data.doctorEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send doctor approval email:", error?.response?.body || error.message);
    return false;
  }
}

export async function sendAdminNotificationEmail(data: AdminEmailData): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a365d;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">Paw Credentials</h1>
        <p style="margin:5px 0 0;">Admin Notification</p>
      </div>
      <div style="padding:20px;background:#f9fafb;">
        <h2>New ESA Letter Request Submitted</h2>
        <p>A new ESA letter request has been submitted and assigned to <strong>Dr. ${data.doctorName}</strong>.</p>
        <div style="background:white;padding:15px;border-radius:8px;margin:16px 0;">
          <h3 style="margin-top:0;">Patient Information</h3>
          <p><strong>Name:</strong> ${data.patientName}</p>
          <p><strong>Email:</strong> ${data.patientEmail}</p>
          <p><strong>Package:</strong> ${data.packageName}</p>
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
        </div>
        <h3>Submitted Details</h3>
        ${formatFormData(data.formData)}
        <div style="text-align:center;margin:30px 0;">
          <a href="${data.reviewUrl}" style="background:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
            Review &amp; Approve
          </a>
        </div>
        <p style="color:#666;font-size:12px;">You are receiving this because you are configured as the admin notification recipient.</p>
      </div>
    </div>
  `;

  if (!SENDGRID_API_KEY) {
    console.log(`[email] Would send admin notification to ${data.adminEmail} for application ${data.applicationId}`);
    return true;
  }

  try {
    await sgMail.send({
      to: data.adminEmail,
      from: SENDGRID_FROM_EMAIL,
      subject: `[Admin] New ESA Letter Request: ${data.patientName} - ${data.packageName}`,
      html,
    });
    console.log(`Admin notification email sent to ${data.adminEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send admin notification email:", error?.response?.body || error.message);
    return false;
  }
}

interface WelcomeEmailData {
  userEmail: string;
  userName: string;
  tempPassword: string;
  loginUrl: string;
  userLevel: number;
  levelName: string;
}

export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  const roleDescription = data.userLevel === 2
    ? "You have been set up as a reviewing doctor on our platform. You will receive review requests via email."
    : data.userLevel === 3
    ? "You have been set up as an administrator on our platform."
    : "Welcome to Paw Credentials! Your account has been created.";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#1a365d;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">Paw Credentials</h1>
        <p style="margin:5px 0 0;">Welcome to the Platform</p>
      </div>
      <div style="padding:20px;background:#f9fafb;">
        <h2>Welcome, ${data.userName}!</h2>
        <p>${roleDescription}</p>
        <div style="background:white;padding:15px;border-radius:8px;margin:16px 0;border:2px solid #2563eb;">
          <h3 style="margin-top:0;color:#1a365d;">Your Login Credentials</h3>
          <p><strong>Email:</strong> ${data.userEmail}</p>
          <p><strong>Temporary Password:</strong> ${data.tempPassword}</p>
          <p style="color:#dc2626;font-size:13px;margin-top:10px;">Please change your password after your first login.</p>
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="${data.loginUrl}" style="background:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
            Log In Now
          </a>
        </div>
        <p style="color:#666;font-size:12px;">If you did not expect this email, please disregard it.</p>
      </div>
    </div>
  `;

  if (!SENDGRID_API_KEY) {
    console.log(`[email] Would send welcome email to ${data.userEmail}`);
    console.log(`[email] Temp password: ${data.tempPassword}`);
    return true;
  }

  try {
    await sgMail.send({
      to: data.userEmail,
      from: SENDGRID_FROM_EMAIL,
      subject: `Welcome to Paw Credentials — Your Account is Ready`,
      html,
    });
    console.log(`Welcome email sent to ${data.userEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send welcome email:", error?.response?.body || error.message);
    return false;
  }
}

export async function sendPatientApprovalEmail(data: PatientApprovalEmailData): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#059669;color:white;padding:20px;text-align:center;">
        <h1 style="margin:0;">Paw Credentials</h1>
        <p style="margin:5px 0 0;">Great News!</p>
      </div>
      <div style="padding:20px;background:#f9fafb;">
        <h2>Your ${data.packageName} Has Been Approved!</h2>
        <p>Dear ${data.patientName},</p>
        <p>We are pleased to inform you that your ESA letter request has been reviewed and <strong>approved</strong> by a licensed healthcare professional.</p>
        <div style="background:white;padding:15px;border-radius:8px;margin:16px 0;">
          <h3 style="margin-top:0;">What's Next?</h3>
          <p>Your documents are being prepared and will be available in your dashboard shortly. You can access them at any time by logging into your account.</p>
        </div>
        <div style="text-align:center;margin:30px 0;">
          <a href="${data.dashboardUrl}" style="background:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;">
            View My Documents
          </a>
        </div>
        <p style="color:#666;font-size:12px;">If you have any questions, please contact our support team.</p>
      </div>
    </div>
  `;

  if (!SENDGRID_API_KEY) {
    console.log(`[email] Would send patient approval email to ${data.patientEmail} for application ${data.applicationId}`);
    return true;
  }

  try {
    await sgMail.send({
      to: data.patientEmail,
      from: SENDGRID_FROM_EMAIL,
      subject: `Your ${data.packageName} Has Been Approved!`,
      html,
    });
    console.log(`Patient approval email sent to ${data.patientEmail}`);
    return true;
  } catch (error: any) {
    console.error("Failed to send patient approval email:", error?.response?.body || error.message);
    return false;
  }
}
