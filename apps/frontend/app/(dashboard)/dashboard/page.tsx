'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Stream } from '@/lib/api';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { PageSection } from '@/components/layout/page-section';
import { LoadingSkeletonCard } from '@/components/layout/loading-skeleton';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const mockActivityData = [
  { date: 'Jan 1', detections: 10 },
  { date: 'Jan 2', detections: 12 },
  { date: 'Jan 3', detections: 8 },
  { date: 'Jan 4', detections: 15 },
  { date: 'Jan 5', detections: 10 },
  { date: 'Jan 6', detections: 12 },
  { date: 'Jan 7', detections: 18 },
];

/**
 * Dashboard Page
 * Overview page showing system metrics, streams, and detection trends
 * Uses PageHeader and PageSection components for consistent layout
 */

export default function DashboardPage() {
  const { data: streams, isLoading: streamsLoading } = useQuery<Stream[]>({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data),
  });

  const { data: detections, isLoading: detectionsLoading } = useQuery({
    queryKey: ['detections'],
    queryFn: () => apiClient.listDetections({ take: 100 }).then((res) => res.data),
  });

  const activeStreams = streams?.filter((s: Stream) => s.status === 'RUNNING').length || 0;
  const totalDetections = detections?.length || 0;
  const isLoading = streamsLoading || detectionsLoading;

  return (
    <PageSection>
      <PageHeader
        title="Dashboard"
        description="Welcome back! Here's an overview of your system."
      />

      {/* Stats Cards */}
      {isLoading ? (
        <LoadingSkeletonCard count={4} variant="grid" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{streams?.length || 0}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeStreams} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeStreams}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Running right now
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Detections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDetections}</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Good</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All systems operational
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Detections Trend</CardTitle>
            <CardDescription>Daily detections over the past week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockActivityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="detections" fill="#0f172a" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Recent system activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm">
                <div className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">Stream activated</p>
                  <p className="text-slate-500 dark:text-slate-400">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">Detection event recorded</p>
                  <p className="text-slate-500 dark:text-slate-400">5 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <div>
                  <p className="font-medium">System health check</p>
                  <p className="text-slate-500 dark:text-slate-400">15 minutes ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageSection>
  );
}
