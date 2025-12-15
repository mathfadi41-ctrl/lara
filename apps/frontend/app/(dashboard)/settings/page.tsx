'use client';

import React from 'react';
import { useAuthStore } from '@/lib/store';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    apiClient.logout();
    logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Manage your account and system settings
        </p>
      </div>

      {/* Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Email</p>
            <p className="text-sm">{user?.email}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Role</p>
            <p className="text-sm">{user?.role}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">User ID</p>
            <p className="text-sm font-mono">{user?.id}</p>
          </div>
        </CardContent>
      </Card>

      {/* API Settings */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>Configure API endpoints and connection settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">API URL</p>
            <p className="text-sm font-mono">{process.env.NEXT_PUBLIC_API_URL}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">AI Service URL</p>
            <p className="text-sm font-mono">{process.env.NEXT_PUBLIC_AI_URL}</p>
          </div>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>Manage your active session</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleLogout}>
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
