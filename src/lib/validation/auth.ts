import { z } from "zod";

/**
 * Reusable password complexity validator:
 * - Minimum 8 characters
 * - Maximum 100 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordValidator = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password cannot exceed 100 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Reusable normalized email validator
 */
export const emailValidator = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .email("Please provide a valid email address")
  .max(255, "Email is too long");

/**
 * Schema for user signup
 */
export const signupSchema = z
  .object({
    name: z
      .string({ required_error: "Name is required" })
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),
    email: emailValidator,
    password: passwordValidator,
    confirmPassword: z.string({ required_error: "Please confirm your password" }),
  })
  .strict({ message: "Unexpected field provided in signup request" })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * Schema for credentials login
 */
export const loginSchema = z
  .object({
    email: emailValidator,
    password: z
      .string({ required_error: "Password is required" })
      .min(1, "Password cannot be empty")
      .max(100, "Password is too long"),
  })
  .strict({ message: "Unexpected field provided in login request" });

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Schema for forgot password request
 */
export const forgotPasswordSchema = z
  .object({
    email: emailValidator,
  })
  .strict({ message: "Unexpected field provided in forgot password request" });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema for password reset submission
 */
export const resetPasswordSchema = z
  .object({
    token: z
      .string({ required_error: "Reset token is required" })
      .trim()
      .min(1, "Reset token cannot be empty")
      .max(128, "Token is invalid"),
    email: emailValidator,
    password: passwordValidator,
    confirmPassword: z.string({ required_error: "Please confirm your password" }),
  })
  .strict({ message: "Unexpected field provided in reset password request" })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema for email verification submission
 */
export const verifyEmailSchema = z
  .object({
    token: z
      .string({ required_error: "Verification token is required" })
      .trim()
      .min(1, "Token cannot be empty")
      .max(128, "Token is invalid"),
    email: emailValidator,
  })
  .strict({ message: "Unexpected field provided in verification request" });

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/**
 * Schema for resending email verification
 */
export const resendVerificationSchema = z
  .object({
    email: emailValidator,
  })
  .strict({ message: "Unexpected field provided in resend verification request" });

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

/**
 * Schema for changing password when authenticated
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: "Current password is required" })
      .min(1, "Current password cannot be empty")
      .max(100, "Current password is too long"),
    newPassword: passwordValidator,
    confirmPassword: z.string({ required_error: "Please confirm your new password" }),
  })
  .strict({ message: "Unexpected field provided in change password request" })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from current password",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
