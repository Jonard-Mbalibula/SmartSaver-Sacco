/**
 * Email Notification System
 * 
 * Sends email notifications for important events:
 * - Loan application approved/rejected
 * - Account status changes
 * - Password resets
 * 
 * Uses Supabase Auth email templates + custom transactional emails
 */

"use server";

import { createSupabaseServerClient } from "./supabase";

/**
 * Email templates
 */
const EMAIL_TEMPLATES = {
  LOAN_APPROVED: {
    subject: "Loan Application Approved - SmartSaver SACCO",
    getBody: (data: {
      memberName: string;
      principal: number;
      interestRate: number;
      termMonths: number;
      monthlyPayment: number;
    }) => `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #0f765d;">Congratulations! Your Loan is Approved</h2>
            
            <p>Dear ${data.memberName},</p>
            
            <p>We are pleased to inform you that your loan application has been approved.</p>
            
            <div style="background: #f5f7f3; border-left: 4px solid #0f765d; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Loan Details:</h3>
              <table style="width: 100%;">
                <tr>
                  <td style="padding: 5px 0;"><strong>Principal Amount:</strong></td>
                  <td style="text-align: right;">UGX ${data.principal.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;"><strong>Interest Rate:</strong></td>
                  <td style="text-align: right;">${data.interestRate}% per month</td>
                </tr>
                <tr>
                  <td style="padding: 5px 0;"><strong>Loan Term:</strong></td>
                  <td style="text-align: right;">${data.termMonths} months</td>
                </tr>
                <tr style="border-top: 2px solid #dfe7e2;">
                  <td style="padding: 5px 0;"><strong>Monthly Payment:</strong></td>
                  <td style="text-align: right; color: #0f765d; font-size: 1.2em;">
                    <strong>UGX ${data.monthlyPayment.toLocaleString()}</strong>
                  </td>
                </tr>
              </table>
            </div>
            
            <p>Please visit our office to complete the disbursement process.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>SmartSaver SACCO Team</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #dfe7e2; margin: 30px 0;">
            <p style="font-size: 0.9em; color: #66736f;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `
  },
  
  LOAN_REJECTED: {
    subject: "Loan Application Update - SmartSaver SACCO",
    getBody: (data: {
      memberName: string;
      principal: number;
      reason: string;
    }) => `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #b74747;">Loan Application Status Update</h2>
            
            <p>Dear ${data.memberName},</p>
            
            <p>Thank you for your loan application for UGX ${data.principal.toLocaleString()}.</p>
            
            <p>After careful review, we are unable to approve your application at this time.</p>
            
            <div style="background: #fff5f5; border-left: 4px solid #b74747; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #b74747;">Reason:</h3>
              <p style="margin-bottom: 0;">${data.reason}</p>
            </div>
            
            <p>We encourage you to:</p>
            <ul>
              <li>Continue building your savings balance</li>
              <li>Ensure your account remains in good standing</li>
              <li>Contact us to discuss your options</li>
            </ul>
            
            <p>You may reapply after addressing the items above.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>SmartSaver SACCO Team</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #dfe7e2; margin: 30px 0;">
            <p style="font-size: 0.9em; color: #66736f;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `
  },
  
  ACCOUNT_CLOSED: {
    subject: "Account Status Update - SmartSaver SACCO",
    getBody: (data: {
      memberName: string;
      reason: string;
    }) => `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #66736f;">Account Status Update</h2>
            
            <p>Dear ${data.memberName},</p>
            
            <p>Your SmartSaver SACCO account has been closed.</p>
            
            <div style="background: #f5f7f3; border-left: 4px solid #66736f; padding: 15px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Reason:</h3>
              <p style="margin-bottom: 0;">${data.reason}</p>
            </div>
            
            <p>All your financial records have been preserved in accordance with our record-keeping policy.</p>
            
            <p>If you have any questions or believe this was done in error, please contact our office.</p>
            
            <p style="margin-top: 30px;">
              Best regards,<br>
              <strong>SmartSaver SACCO Team</strong>
            </p>
            
            <hr style="border: none; border-top: 1px solid #dfe7e2; margin: 30px 0;">
            <p style="font-size: 0.9em; color: #66736f;">
              This is an automated message. Please do not reply to this email.
            </p>
          </div>
        </body>
      </html>
    `
  }
};

/**
 * Send email via Supabase Auth (for auth-related emails) or custom provider
 * 
 * Note: For production, integrate with SendGrid, AWS SES, or other email service
 * This implementation uses a simplified approach for demonstration
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // In production, use an email service like SendGrid, AWS SES, etc.
    // For now, we'll log the email (in production, this would actually send)
    
    console.log('📧 Email would be sent:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Body length:', htmlBody.length);
    
    // TODO: Integrate with actual email service
    // Example with SendGrid:
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    // await sgMail.send({ to, from: 'noreply@smartsaver.ug', subject, html: htmlBody });
    
    return { success: true };
  } catch (error) {
    console.error('Email send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get member email from user profile
 */
async function getMemberEmail(memberId: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  
  // Get user_id from member
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("member_id", memberId)
    .single();
  
  if (!profile) return null;
  
  // Get email from auth.users
  const { data: { user } } = await supabase.auth.admin.getUserById(profile.id);
  
  return user?.email ?? null;
}

/**
 * Send loan approval email
 */
export async function sendLoanApprovedEmail(data: {
  memberId: string;
  memberName: string;
  principal: number;
  interestRate: number;
  termMonths: number;
}): Promise<{ success: boolean; error?: string }> {
  const email = await getMemberEmail(data.memberId);
  
  if (!email) {
    console.warn('No email found for member:', data.memberId);
    return { success: false, error: 'Member email not found' };
  }
  
  const monthlyPayment = calculateMonthlyPayment(
    data.principal,
    data.interestRate,
    data.termMonths
  );
  
  const template = EMAIL_TEMPLATES.LOAN_APPROVED;
  const htmlBody = template.getBody({
    ...data,
    monthlyPayment
  });
  
  return sendEmail(email, template.subject, htmlBody);
}

/**
 * Send loan rejection email
 */
export async function sendLoanRejectedEmail(data: {
  memberId: string;
  memberName: string;
  principal: number;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const email = await getMemberEmail(data.memberId);
  
  if (!email) {
    console.warn('No email found for member:', data.memberId);
    return { success: false, error: 'Member email not found' };
  }
  
  const template = EMAIL_TEMPLATES.LOAN_REJECTED;
  const htmlBody = template.getBody(data);
  
  return sendEmail(email, template.subject, htmlBody);
}

/**
 * Send account closure email
 */
export async function sendAccountClosedEmail(data: {
  memberId: string;
  memberName: string;
  reason: string;
}): Promise<{ success: boolean; error?: string }> {
  const email = await getMemberEmail(data.memberId);
  
  if (!email) {
    console.warn('No email found for member:', data.memberId);
    return { success: false, error: 'Member email not found' };
  }
  
  const template = EMAIL_TEMPLATES.ACCOUNT_CLOSED;
  const htmlBody = template.getBody(data);
  
  return sendEmail(email, template.subject, htmlBody);
}

/**
 * Calculate monthly loan payment
 */
function calculateMonthlyPayment(
  principal: number,
  monthlyRate: number,
  months: number
): number {
  // Simple calculation: (principal + interest) / months
  // For compound interest, use: P * r * (1 + r)^n / ((1 + r)^n - 1)
  const totalInterest = principal * (monthlyRate / 100);
  const totalAmount = principal + totalInterest;
  return Math.round(totalAmount / months);
}
