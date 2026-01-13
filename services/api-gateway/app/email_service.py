import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import secrets
from datetime import datetime, timedelta


# Email configuration from environment
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME)
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "PantryPal")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

# Check if email is configured
EMAIL_ENABLED = bool(SMTP_HOST and SMTP_USERNAME and SMTP_PASSWORD)


def is_email_configured() -> bool:
    """Check if email service is configured"""
    return EMAIL_ENABLED


def send_email(to_email: str, subject: str, html_content: str, text_content: Optional[str] = None):
    """
    Send an email using SMTP
    """
    if not EMAIL_ENABLED:
        raise ValueError("Email service not configured. Please set SMTP environment variables.")
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        
        # Add text and HTML parts
        if text_content:
            part1 = MIMEText(text_content, 'plain')
            msg.attach(part1)
        
        part2 = MIMEText(html_content, 'html')
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
        
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        raise


def send_password_reset_email(to_email: str, reset_token: str, base_url: str):
    """
    Send password reset email with token link
    """
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    
    subject = "Reset Your PantryPal Password"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }}
            .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }}
            .warning {{ background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 32px;">🥫 PantryPal</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Part of PalStack</p>
            </div>
            <div class="content">
                <h2>Reset Your Password</h2>
                <p>We received a request to reset your password for your PantryPal account.</p>
                <p>Click the button below to create a new password:</p>
                <div style="text-align: center;">
                    <a href="{reset_link}" class="button">Reset Password</a>
                </div>
                <div class="warning">
                    <strong>⚠️ This link expires in 1 hour</strong><br>
                    For your security, this password reset link will only work once and expires in 60 minutes.
                </div>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    If you didn't request this password reset, you can safely ignore this email. 
                    Your password will remain unchanged.
                </p>
                <p style="color: #6b7280; font-size: 14px;">
                    <strong>Link not working?</strong> Copy and paste this URL into your browser:<br>
                    <code style="background: #f3f4f6; padding: 5px; border-radius: 4px; word-break: break-all;">{reset_link}</code>
                </p>
            </div>
            <div class="footer">
                <p>This email was sent from your PantryPal installation</p>
                <p>🥫 PantryPal • Self-hosted pantry management</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    text_content = f"""
    Reset Your PantryPal Password
    
    We received a request to reset your password for your PantryPal account.
    
    Click this link to create a new password:
    {reset_link}
    
    This link expires in 1 hour.
    
    If you didn't request this password reset, you can safely ignore this email.
    
    ---
    PantryPal - Self-hosted pantry management
    """
    
    send_email(to_email, subject, html_content, text_content)


def send_verification_email(to_email: str, username: str, verification_token: str, base_url: str):
    """
    Send email verification link to new users
    """
    verification_link = f"{base_url}/verify-email?token={verification_token}"

    subject = "Verify Your PantryPal Email 🥫"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }}
            .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }}
            .warning {{ background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 32px;">🥫 PantryPal</h1>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Part of PalStack</p>
            </div>
            <div class="content">
                <h2>Hi {username}! 👋</h2>
                <p>Welcome to PantryPal! Please verify your email address to activate your account.</p>
                <p>Click the button below to verify your email:</p>
                <div style="text-align: center;">
                    <a href="{verification_link}" class="button">Verify Email Address</a>
                </div>
                <div class="warning">
                    <strong>⏰ This link expires in 24 hours</strong><br>
                    For your security, this verification link will only work once and expires in 24 hours.
                </div>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                    If you didn't create a PantryPal account, you can safely ignore this email.
                </p>
                <p style="color: #6b7280; font-size: 14px;">
                    <strong>Link not working?</strong> Copy and paste this URL into your browser:<br>
                    <code style="background: #f3f4f6; padding: 5px; border-radius: 4px; word-break: break-all;">{verification_link}</code>
                </p>
            </div>
            <div class="footer">
                <p>This email was sent from your PantryPal installation</p>
                <p>🥫 PantryPal • Self-hosted pantry management</p>
            </div>
        </div>
    </body>
    </html>
    """

    text_content = f"""
    Verify Your PantryPal Email

    Hi {username}!

    Welcome to PantryPal! Please verify your email address to activate your account.

    Click this link to verify your email:
    {verification_link}

    This link expires in 24 hours.

    If you didn't create a PantryPal account, you can safely ignore this email.

    ---
    PantryPal - Self-hosted pantry management
    """

    send_email(to_email, subject, html_content, text_content)


def send_welcome_email(to_email: str, username: str, base_url: str, reset_token: str = None):
    """
    Send welcome email to new users
    If reset_token is provided, includes a password setup link for admin-created users
    """
    subject = "Welcome to PantryPal! 🥫"

    # Different content based on whether this is admin-created (with reset token) or self-registered
    if reset_token:
        action_button = f'<a href="{base_url}/reset-password?token={reset_token}" class="button">Set Your Password</a>'
        intro_text = "Your account has been created by an administrator. To get started, please set your password by clicking the button below:"
    else:
        action_button = f'<a href="{base_url}" class="button">Open PantryPal</a>'
        intro_text = "Your account has been created successfully. You're now ready to start managing your pantry!"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
            .content {{ background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px; }}
            .button {{ display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }}
            .footer {{ text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }}
            .feature {{ background: #f9fafb; padding: 15px; margin: 10px 0; border-radius: 8px; border-left: 4px solid #667eea; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1 style="margin: 0; font-size: 32px;">🥫 Welcome to PantryPal!</h1>
            </div>
            <div class="content">
                <h2>Hi {username}! 👋</h2>
                <p>{intro_text}</p>

                <div style="text-align: center;">
                    {action_button}
                </div>
                
                <h3>What you can do:</h3>
                <div class="feature">
                    📷 <strong>Scan Barcodes</strong> - Quickly add items with your camera
                </div>
                <div class="feature">
                    🔔 <strong>Get Notifications</strong> - Never let food expire again
                </div>
                <div class="feature">
                    🏠 <strong>Home Assistant</strong> - Integrate with your smart home
                </div>
                <div class="feature">
                    📊 <strong>Track Everything</strong> - Know what you have, where it is
                </div>
                
                <p style="margin-top: 30px;">
                    Need help getting started? Check out the documentation or reach out to your system administrator.
                </p>
            </div>
            <div class="footer">
                <p>🥫 PantryPal • Part of PalStack</p>
                <p>Self-hosted pantry management for modern homes</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    if reset_token:
        action_text = f"Set Your Password: {base_url}/reset-password?token={reset_token}"
        intro_text_plain = "Your account has been created by an administrator. To get started, please set your password using the link below:"
    else:
        action_text = f"Open PantryPal: {base_url}"
        intro_text_plain = "Your account has been created successfully. You're now ready to start managing your pantry!"

    text_content = f"""
    Welcome to PantryPal!

    Hi {username}!

    {intro_text_plain}

    {action_text}

    What you can do:
    📷 Scan barcodes to quickly add items
    🔔 Get notifications about expiring items
    🏠 Integrate with Home Assistant
    📊 Track your entire pantry inventory

    ---
    PantryPal - Part of PalStack
    Self-hosted pantry management for modern homes
    """
    
    send_email(to_email, subject, html_content, text_content)