"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Loader2,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const [savedNotice, setSavedNotice] = React.useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="space-y-5 pb-16 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Settings & Integrations
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your account profile, provider API keys, calendar sync, and outreach preferences
        </p>
      </div>

      {savedNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 p-3 rounded-md bg-success-tint border border-success/30 text-xs text-success font-medium animate-in fade-in"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="profile">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="ai">AI Provider</TabsTrigger>
          <TabsTrigger value="email">Email Accounts</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="lead-sources">Lead Sources</TabsTrigger>
          <TabsTrigger value="outreach">Outreach Defaults</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Freelancer Profile</CardTitle>
              <CardDescription>Your personal identity and sender signature information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4 max-w-lg text-xs">
                <Input
                  label="Full Name"
                  name="fullName"
                  autoComplete="name"
                  defaultValue="Maulik Pandey"
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  spellCheck={false}
                  defaultValue="maulik@outreachos.dev"
                />
                <Input
                  label="Professional Title"
                  name="title"
                  defaultValue="Freelance Full-Stack Consultant"
                />
                <Input
                  label="Portfolio / Website"
                  name="website"
                  type="url"
                  autoComplete="url"
                  spellCheck={false}
                  defaultValue="https://maulikpandey.dev"
                />
                <Button type="submit" size="sm">Save Profile</Button>
              </form>
            </CardContent>
          </Card>
          <ChangePasswordCard />
        </TabsContent>

        {/* AI Provider Tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">AI Personalization Provider</CardTitle>
              <CardDescription>
                Configure OpenAI or any OpenAI-compatible API endpoint for company research and tailored outreach
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4 max-w-lg text-xs">
                <Input
                  label="Provider Base URL"
                  name="aiBaseUrl"
                  spellCheck={false}
                  defaultValue="https://api.openai.com/v1"
                  placeholder="https://api.openai.com/v1"
                />
                <Input
                  label="Model Identifier"
                  name="aiModel"
                  spellCheck={false}
                  defaultValue="gpt-4o-mini"
                  placeholder="gpt-4o, claude-3-5-sonnet, or custom…"
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-foreground" htmlFor="aiApiKey">
                    API Key (Stored securely server-side)
                  </label>
                  <div className="relative">
                    <Input
                      id="aiApiKey"
                      name="aiApiKey"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="sk-proj-••••••••••••••••••••"
                    />
                    <Lock className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Keys are encrypted at rest and never exposed to client-side scripts.
                  </p>
                </div>
                <Button type="submit" size="sm">Save AI Provider</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Provider Tab */}
        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outreach Sending Account (SMTP / Resend / SendGrid)</CardTitle>
              <CardDescription>Configure the email server used for automated outreach and follow-ups</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4 max-w-lg text-xs">
                <Input
                  label="SMTP Host"
                  name="smtpHost"
                  spellCheck={false}
                  placeholder="smtp.resend.com or smtp.gmail.com…"
                />
                <Input
                  label="SMTP Port"
                  name="smtpPort"
                  type="number"
                  inputMode="numeric"
                  placeholder="587"
                  defaultValue="587"
                />
                <Input
                  label="Username / API User"
                  name="smtpUser"
                  spellCheck={false}
                  placeholder="resend or user@domain.com…"
                />
                <Input
                  label="Password / Secret Key"
                  name="smtpPassword"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="••••••••••••"
                />
                <Input
                  label="From Email Address"
                  name="smtpFrom"
                  type="email"
                  spellCheck={false}
                  placeholder="maulik@yourdomain.com…"
                />
                <Button type="submit" size="sm">Save Email Configuration</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Google Calendar Integration</CardTitle>
              <CardDescription>
                Synchronize your availability to generate automatic booking links and prevent double bookings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Connect your Google Calendar account via OAuth 2.0 to sync meetings into your pipeline.
              </p>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
                Connect Google Calendar
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lead Sources Tab */}
        <TabsContent value="lead-sources">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lead Discovery Data Provider</CardTitle>
              <CardDescription>
                Connect a compliant B2B data provider (Apollo, Clearbit, Hunter) for the Client Finder module
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4 max-w-lg text-xs">
                <Select label="Supported Provider" name="leadProviderType">
                  <option value="apollo">Apollo.io API</option>
                  <option value="hunter">Hunter.io API</option>
                  <option value="clearbit">Clearbit / HubSpot</option>
                  <option value="custom">Custom Enterprise Data Endpoint</option>
                </Select>
                <Input
                  label="Provider API Key"
                  name="leadProviderKey"
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="api_key_••••••••••••"
                />
                <Button type="submit" size="sm">Save Lead Provider</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Outreach Defaults</CardTitle>
              <CardDescription>Daily sending limits, follow-up cadence, and warm-up guardrails</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4 max-w-lg text-xs">
                <Input
                  label="Max New Emails Per Day"
                  name="maxEmailsPerDay"
                  type="number"
                  inputMode="numeric"
                  defaultValue="30"
                />
                <Input
                  label="Delay Between Emails (Seconds)"
                  name="delayBetweenEmails"
                  type="number"
                  inputMode="numeric"
                  defaultValue="120"
                />
                <Select label="Default Follow-up Delay" name="followUpDelayDays">
                  <option value="3">3 Days</option>
                  <option value="4">4 Days</option>
                  <option value="7">7 Days</option>
                </Select>
                <Button type="submit" size="sm">Save Outreach Defaults</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tracking Tab */}
        <TabsContent value="tracking">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Telemetry & Privacy Tracking</CardTitle>
              <CardDescription>Configure open tracking pixels, link click redirects, and unsubscribe headers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-input" />
                  <span className="font-medium text-foreground">Enable Open Tracking Pixels</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-input" />
                  <span className="font-medium text-foreground">Enable Click Tracking on Links</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-input" />
                  <span className="font-medium text-foreground">Include RFC-8058 One-Click Unsubscribe Header</span>
                </label>
              </div>
              <Button size="sm" onClick={handleSave}>Save Tracking Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notification Preferences</CardTitle>
              <CardDescription>Real-time alerts when leads reply or meetings are booked</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-input" />
                  <span className="font-medium text-foreground">Email alert on positive prospect reply</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded border-input" />
                  <span className="font-medium text-foreground">Email alert when meeting is scheduled</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded border-input" />
                  <span className="font-medium text-foreground">Weekly pipeline performance summary</span>
                </label>
              </div>
              <Button size="sm" onClick={handleSave}>Save Notification Preferences</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!currentPassword) {
      setError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update password.");
      } else {
        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <span>Account Security & Password</span>
        </CardTitle>
        <CardDescription>
          Update your studio password to maintain account integrity and refresh active sessions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {success && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-success/15 border border-success/30 text-xs text-success font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Password updated successfully.</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-md bg-danger/10 border border-danger/25 text-xs text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg text-xs">
          <Input
            label="Current Password"
            name="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <div>
            <Input
              label="New Password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Minimum 8 characters with 1 uppercase, 1 lowercase, and 1 number
            </p>
          </div>
          <Input
            label="Confirm New Password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Updating password…" : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
