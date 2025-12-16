'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import type { Stream, StreamHealth, StreamStatus } from '@/lib/api';
import { apiClient } from '@/lib/api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/layout/empty-state';
import { LoadingSkeletonCard } from '@/components/layout/loading-skeleton';
import { Pencil, Play, Square, Trash2, Thermometer, Camera, Split } from 'lucide-react';
import type { StreamType, SplitLayout } from '@/lib/api';

const createStreamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rtspUrl: z.string().url('Invalid RTSP URL'),
  fps: z.coerce.number().int().min(1).max(30).default(5),
  detectionEnabled: z.boolean().default(true),
  type: z.enum(['COLOR', 'THERMAL', 'SPLIT']).default('COLOR'),
  splitLayout: z.enum(['LEFT_RIGHT', 'TOP_BOTTOM']).optional(),
}).refine((data) => {
  if (data.type === 'SPLIT' && !data.splitLayout) {
    return false;
  }
  return true;
}, {
  message: "Split layout is required for SPLIT stream type",
  path: ['splitLayout'],
});

type CreateStreamFormData = z.infer<typeof createStreamSchema>;

const editStreamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rtspUrl: z.string().url('Invalid RTSP URL'),
  fps: z.coerce.number().int().min(1).max(30),
  type: z.enum(['COLOR', 'THERMAL', 'SPLIT']),
  splitLayout: z.enum(['LEFT_RIGHT', 'TOP_BOTTOM']).optional(),
}).refine((data) => {
  if (data.type === 'SPLIT' && !data.splitLayout) {
    return false;
  }
  return true;
}, {
  message: "Split layout is required for SPLIT stream type",
  path: ['splitLayout'],
});

type EditStreamFormData = z.infer<typeof editStreamSchema>;

// Stream type helper functions
function getStreamTypeInfo(type: StreamType) {
  switch (type) {
    case 'COLOR':
      return { label: 'Color', icon: <Camera className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50' };
    case 'THERMAL':
      return { label: 'Thermal', icon: <Thermometer className="h-4 w-4" />, color: 'text-red-600', bg: 'bg-red-50' };
    case 'SPLIT':
      return { label: 'Split', icon: <Split className="h-4 w-4" />, color: 'text-purple-600', bg: 'bg-purple-50' };
    default:
      return { label: 'Unknown', icon: <Camera className="h-4 w-4" />, color: 'text-gray-600', bg: 'bg-gray-50' };
  }
}

function getSplitLayoutInfo(layout?: SplitLayout) {
  if (!layout) return null;
  switch (layout) {
    case 'LEFT_RIGHT':
      return { label: 'Left|Right', icon: '↔️' };
    case 'TOP_BOTTOM':
      return { label: 'Top|Bottom', icon: '↕️' };
    default:
      return { label: 'Unknown', icon: '❓' };
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const err = error as {
    response?: { data?: unknown };
    message?: unknown;
  };

  if (err.response?.data && typeof err.response.data === 'object') {
    const data = err.response.data as { message?: unknown };
    if (typeof data.message === 'string') return data.message;
  }

  if (typeof err.message === 'string') return err.message;

  return fallback;
}

function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();

  if (Number.isNaN(diffMs)) return '—';
  if (diffMs < 0) return 'just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function isHeartbeatStale(lastHeartbeat: string | null | undefined): boolean {
  if (!lastHeartbeat) return true;
  const date = new Date(lastHeartbeat);
  const diffMs = Date.now() - date.getTime();
  return Number.isNaN(diffMs) ? true : diffMs > 30_000;
}

function StatusBadge({ status, stale }: { status: StreamStatus; stale: boolean }) {
  const { label, classes } = useMemo(() => {
    if (status === 'RUNNING') {
      return {
        label: stale ? 'RUNNING (stale)' : 'RUNNING',
        classes: stale
          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
          : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
      };
    }

    if (status === 'STARTING') {
      return {
        label: 'STARTING',
        classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
      };
    }

    if (status === 'STOPPING') {
      return {
        label: 'STOPPING',
        classes: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      };
    }

    if (status === 'ERROR') {
      return {
        label: 'ERROR',
        classes: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
      };
    }

    return {
      label: 'STOPPED',
      classes: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    };
  }, [status, stale]);

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

function StreamTypeBadge({ type, splitLayout }: { type?: StreamType; splitLayout?: SplitLayout }) {
  if (!type) return null;
  
  const typeInfo = getStreamTypeInfo(type);
  const layoutInfo = getSplitLayoutInfo(splitLayout);
  
  return (
    <div className="flex items-center gap-1">
      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${typeInfo.bg} ${typeInfo.color}`}>
        {typeInfo.icon}
        {typeInfo.label}
      </span>
      {layoutInfo && (
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          {layoutInfo.icon} {layoutInfo.label}
        </span>
      )}
    </div>
  );
}

function StreamCard({ stream }: { stream: Stream }) {
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const healthQuery = useQuery({
    queryKey: ['stream-health', stream.id],
    queryFn: () => apiClient.getStreamHealth(stream.id).then((res) => res.data),
    refetchInterval: 5000,
    staleTime: 0,
    retry: 1,
  });

  const health: StreamHealth | undefined = healthQuery.data;

  useEffect(() => {
    if (!health) return;

    queryClient.setQueryData<Stream[]>(['streams'], (prev) =>
      prev?.map((s) =>
        s.id === stream.id
          ? {
              ...s,
              status: health.status,
              detectionEnabled: health.detectionEnabled,
              fps: health.fps,
              lastHeartbeat: health.lastHeartbeat,
              lastFrameAt: health.lastFrameAt,
              avgLatencyMs: health.avgLatencyMs,
            }
          : s
      )
    );
  }, [health, queryClient, stream.id]);

  const status = health?.status ?? stream.status;
  const detectionEnabled = health?.detectionEnabled ?? stream.detectionEnabled;
  const fps = health?.fps ?? stream.fps;
  const lastHeartbeat = health?.lastHeartbeat ?? stream.lastHeartbeat;
  const lastFrameAt = health?.lastFrameAt ?? stream.lastFrameAt;
  const avgLatencyMs = health?.avgLatencyMs ?? stream.avgLatencyMs;

  const heartbeatStale = status === 'RUNNING' && isHeartbeatStale(lastHeartbeat);

  const startMutation = useMutation({
    mutationFn: async () => apiClient.startStream(stream.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['streams'] });
      const previous = queryClient.getQueryData<Stream[]>(['streams']);

      queryClient.setQueryData<Stream[]>(['streams'], (prev) =>
        prev?.map((s) => (s.id === stream.id ? { ...s, status: 'STARTING' } : s))
      );

      queryClient.setQueryData<StreamHealth>(['stream-health', stream.id], (prev) =>
        prev
          ? { ...prev, status: 'STARTING' }
          : {
              id: stream.id,
              name: stream.name,
              status: 'STARTING',
              detectionEnabled,
              fps,
              lastHeartbeat,
              lastFrameAt,
              avgLatencyMs,
            }
      );

      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['streams'], ctx.previous);
      toast.error(getErrorMessage(error, 'Failed to start stream'));
    },
    onSuccess: () => {
      toast.success('Stream start initiated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['stream-health', stream.id] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => apiClient.stopStream(stream.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['streams'] });
      const previous = queryClient.getQueryData<Stream[]>(['streams']);

      queryClient.setQueryData<Stream[]>(['streams'], (prev) =>
        prev?.map((s) => (s.id === stream.id ? { ...s, status: 'STOPPING' } : s))
      );

      queryClient.setQueryData<StreamHealth>(['stream-health', stream.id], (prev) =>
        prev
          ? { ...prev, status: 'STOPPING' }
          : {
              id: stream.id,
              name: stream.name,
              status: 'STOPPING',
              detectionEnabled,
              fps,
              lastHeartbeat,
              lastFrameAt,
              avgLatencyMs,
            }
      );

      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['streams'], ctx.previous);
      toast.error(getErrorMessage(error, 'Failed to stop stream'));
    },
    onSuccess: () => {
      toast.success('Stream stop initiated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['stream-health', stream.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiClient.deleteStream(stream.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['streams'] });
      const previous = queryClient.getQueryData<Stream[]>(['streams']);

      queryClient.setQueryData<Stream[]>(['streams'], (prev) =>
        prev?.filter((s) => s.id !== stream.id)
      );

      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['streams'], ctx.previous);
      toast.error(getErrorMessage(error, 'Failed to delete stream'));
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['stream-health', stream.id] });
      toast.success('Stream deleted');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
    },
  });

  const detectionMutation = useMutation({
    mutationFn: async (enabled: boolean) => apiClient.updateStream(stream.id, { detectionEnabled: enabled }),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ['streams'] });
      const previous = queryClient.getQueryData<Stream[]>(['streams']);

      queryClient.setQueryData<Stream[]>(['streams'], (prev) =>
        prev?.map((s) => (s.id === stream.id ? { ...s, detectionEnabled: enabled } : s))
      );

      queryClient.setQueryData<StreamHealth>(['stream-health', stream.id], (prev) =>
        prev ? { ...prev, detectionEnabled: enabled } : prev
      );

      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['streams'], ctx.previous);
      toast.error(getErrorMessage(error, 'Failed to update detection setting'));
    },
    onSuccess: () => {
      toast.success('Detection updated');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['stream-health', stream.id] });
    },
  });

  const editForm = useForm<EditStreamFormData>({
    resolver: zodResolver(editStreamSchema),
    defaultValues: {
      name: stream.name,
      rtspUrl: stream.rtspUrl,
      fps: stream.fps,
      type: stream.type || 'COLOR',
      splitLayout: stream.splitLayout,
    },
  });

  useEffect(() => {
    if (!editOpen) return;
    editForm.reset({
      name: stream.name,
      rtspUrl: stream.rtspUrl,
      fps,
      type: stream.type || 'COLOR',
      splitLayout: stream.splitLayout,
    });
  }, [editOpen, editForm, stream.name, stream.rtspUrl, fps, stream.type, stream.splitLayout]);

  const editMutation = useMutation({
    mutationFn: async (data: EditStreamFormData) => apiClient.updateStream(stream.id, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['streams'] });
      const previous = queryClient.getQueryData<Stream[]>(['streams']);

      const shouldShowRestarting =
        status === 'RUNNING' && (data.rtspUrl !== stream.rtspUrl || data.fps !== fps);

      queryClient.setQueryData<Stream[]>(['streams'], (prev) =>
        prev?.map((s) =>
          s.id === stream.id
            ? {
                ...s,
                name: data.name,
                rtspUrl: data.rtspUrl,
                fps: data.fps,
                status: shouldShowRestarting ? 'STARTING' : s.status,
              }
            : s
        )
      );

      return { previous };
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['streams'], ctx.previous);
      toast.error(getErrorMessage(error, 'Failed to update stream'));
    },
    onSuccess: () => {
      toast.success('Stream updated');
      setEditOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      queryClient.invalidateQueries({ queryKey: ['stream-health', stream.id] });
    },
  });

  const canStart = status === 'STOPPED' || status === 'ERROR';
  const canStop = status === 'RUNNING';
  const isBusy =
    startMutation.isPending ||
    stopMutation.isPending ||
    deleteMutation.isPending ||
    editMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-lg truncate">{stream.name}</CardTitle>
            <CardDescription className="mt-1 truncate">{stream.rtspUrl}</CardDescription>
            {/* Stream type badge */}
            <div className="mt-2">
              <StreamTypeBadge type={stream.type} splitLayout={stream.splitLayout} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusBadge status={status} stale={heartbeatStale} />
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Edit stream">
                  <Pencil className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit stream</DialogTitle>
                  <DialogDescription>Update RTSP URL and FPS (1-30)</DialogDescription>
                </DialogHeader>

                <form
                  onSubmit={editForm.handleSubmit((data) => editMutation.mutate(data))}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`edit-name-${stream.id}`}>Name</Label>
                    <Input id={`edit-name-${stream.id}`} {...editForm.register('name')} />
                    {editForm.formState.errors.name && (
                      <p className="text-sm text-red-500">{editForm.formState.errors.name.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-rtsp-${stream.id}`}>RTSP URL</Label>
                    <Input id={`edit-rtsp-${stream.id}`} {...editForm.register('rtspUrl')} />
                    {editForm.formState.errors.rtspUrl && (
                      <p className="text-sm text-red-500">{editForm.formState.errors.rtspUrl.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`edit-fps-${stream.id}`}>FPS</Label>
                    <Input id={`edit-fps-${stream.id}`} type="number" min={1} max={30} {...editForm.register('fps')} />
                    {editForm.formState.errors.fps && (
                      <p className="text-sm text-red-500">{editForm.formState.errors.fps.message}</p>
                    )}
                  </div>

                  {/* Stream Type Selection in Edit */}
                  <div className="space-y-3">
                    <Label>Stream Type</Label>
                    <Controller
                      control={editForm.control}
                      name="type"
                      render={({ field }) => (
                        <div className="grid grid-cols-3 gap-2">
                          {(['COLOR', 'THERMAL', 'SPLIT'] as StreamType[]).map((type) => {
                            const typeInfo = getStreamTypeInfo(type);
                            return (
                              <Button
                                key={type}
                                type="button"
                                variant={field.value === type ? "default" : "outline"}
                                className={`justify-start gap-2 ${field.value === type ? typeInfo.bg : ''}`}
                                onClick={() => field.onChange(type)}
                              >
                                {typeInfo.icon}
                                {typeInfo.label}
                              </Button>
                            );
                          })}
                        </div>
                      )}
                    />
                    {editForm.formState.errors.type && (
                      <p className="text-sm text-red-500">{editForm.formState.errors.type.message}</p>
                    )}
                  </div>

                  {/* Split Layout Selection in Edit (conditional) */}
                  {editForm.watch('type') === 'SPLIT' && (
                    <div className="space-y-3">
                      <Label>Split Layout</Label>
                      <Controller
                        control={editForm.control}
                        name="splitLayout"
                        render={({ field }) => (
                          <div className="grid grid-cols-2 gap-2">
                            {(['LEFT_RIGHT', 'TOP_BOTTOM'] as SplitLayout[]).map((layout) => {
                              const layoutInfo = getSplitLayoutInfo(layout);
                              return (
                                <Button
                                  key={layout}
                                  type="button"
                                  variant={field.value === layout ? "default" : "outline"}
                                  className="justify-start gap-2"
                                  onClick={() => field.onChange(layout)}
                                >
                                  {layoutInfo?.icon} {layoutInfo?.label}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                      />
                      {editForm.formState.errors.splitLayout && (
                        <p className="text-sm text-red-500">{editForm.formState.errors.splitLayout.message}</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={editMutation.isPending}>
                      {editMutation.isPending ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (!window.confirm('Delete this stream?')) return;
                        deleteMutation.mutate();
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Last heartbeat</div>
            <div className="text-sm">{formatRelativeTime(lastHeartbeat)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Last frame</div>
            <div className="text-sm">{formatRelativeTime(lastFrameAt)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">FPS</div>
            <div className="text-sm">{fps}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Avg latency</div>
            <div className="text-sm">{`${Math.round(avgLatencyMs)}ms`}</div>
          </div>
        </div>

        {status === 'ERROR' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
            Stream is in ERROR state.
          </div>
        )}

        <div className="flex gap-2">
          {canStop ? (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => stopMutation.mutate()}
              disabled={isBusy || status === 'STOPPING'}
            >
              <Square className="mr-2 h-4 w-4" />
              {status === 'STOPPING' ? 'Stopping…' : 'Stop'}
            </Button>
          ) : (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                if (!canStart) return;
                startMutation.mutate();
              }}
              disabled={!canStart || isBusy || status === 'STARTING' || status === 'STOPPING'}
            >
              {status === 'STOPPING' ? (
                <Square className="mr-2 h-4 w-4" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              {status === 'STARTING' ? 'Starting…' : status === 'STOPPING' ? 'Stopping…' : 'Start'}
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor={`detect-${stream.id}`} className="text-sm">
            AI Detection
          </Label>
          <Switch
            id={`detect-${stream.id}`}
            checked={detectionEnabled}
            onCheckedChange={(checked) => detectionMutation.mutate(checked)}
            disabled={detectionMutation.isPending}
          />
        </div>

        {healthQuery.isError && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Health unavailable (will retry).
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StreamsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data: streams, isLoading, isError } = useQuery({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data),
  });

  const createForm = useForm<CreateStreamFormData>({
    resolver: zodResolver(createStreamSchema),
    defaultValues: {
      name: '',
      rtspUrl: '',
      fps: 5,
      detectionEnabled: true,
      type: 'COLOR',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateStreamFormData) => apiClient.createStream(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream created');
      createForm.reset();
      setCreateOpen(false);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Failed to create stream'));
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="page-header">
          <h1 className="page-title">Streams</h1>
          <p className="page-description">Manage your RTSP streams and AI detection</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Add Stream</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Stream</DialogTitle>
              <DialogDescription>Add a new RTSP stream to the system</DialogDescription>
            </DialogHeader>

            <form
              onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="name">Stream Name</Label>
                <Input id="name" placeholder="e.g., Front Entrance" {...createForm.register('name')} />
                {createForm.formState.errors.name && (
                  <p className="text-sm text-red-500">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rtspUrl">RTSP URL</Label>
                <Input
                  id="rtspUrl"
                  placeholder="rtsp://example.com/stream"
                  {...createForm.register('rtspUrl')}
                />
                {createForm.formState.errors.rtspUrl && (
                  <p className="text-sm text-red-500">{createForm.formState.errors.rtspUrl.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="fps">FPS</Label>
                <Input id="fps" type="number" min={1} max={30} {...createForm.register('fps')} />
                {createForm.formState.errors.fps && (
                  <p className="text-sm text-red-500">{createForm.formState.errors.fps.message}</p>
                )}
              </div>

              {/* Stream Type Selection */}
              <div className="space-y-3">
                <Label>Stream Type</Label>
                <Controller
                  control={createForm.control}
                  name="type"
                  render={({ field }) => (
                    <div className="grid grid-cols-3 gap-2">
                      {(['COLOR', 'THERMAL', 'SPLIT'] as StreamType[]).map((type) => {
                        const typeInfo = getStreamTypeInfo(type);
                        return (
                          <Button
                            key={type}
                            type="button"
                            variant={field.value === type ? "default" : "outline"}
                            className={`justify-start gap-2 ${field.value === type ? typeInfo.bg : ''}`}
                            onClick={() => field.onChange(type)}
                          >
                            {typeInfo.icon}
                            {typeInfo.label}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                />
                {createForm.formState.errors.type && (
                  <p className="text-sm text-red-500">{createForm.formState.errors.type.message}</p>
                )}
              </div>

              {/* Split Layout Selection (conditional) */}
              {createForm.watch('type') === 'SPLIT' && (
                <div className="space-y-3">
                  <Label>Split Layout</Label>
                  <Controller
                    control={createForm.control}
                    name="splitLayout"
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {(['LEFT_RIGHT', 'TOP_BOTTOM'] as SplitLayout[]).map((layout) => {
                          const layoutInfo = getSplitLayoutInfo(layout);
                          return (
                            <Button
                              key={layout}
                              type="button"
                              variant={field.value === layout ? "default" : "outline"}
                              className="justify-start gap-2"
                              onClick={() => field.onChange(layout)}
                            >
                              {layoutInfo?.icon} {layoutInfo?.label}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  />
                  {createForm.formState.errors.splitLayout && (
                    <p className="text-sm text-red-500">{createForm.formState.errors.splitLayout.message}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800">
                <Label htmlFor="create-detection">Enable AI Detection</Label>
                <Controller
                  control={createForm.control}
                  name="detectionEnabled"
                  render={({ field }) => (
                    <Switch
                      id="create-detection"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating…' : 'Create Stream'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <LoadingSkeletonCard count={3} variant="grid" />
      ) : isError ? (
        <EmptyState
          title="Failed to load streams"
          description="Please refresh the page or try again later."
          action={
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['streams'] })}>
              Retry
            </Button>
          }
        />
      ) : streams && streams.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream) => (
            <StreamCard key={stream.id} stream={stream} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No streams yet"
          description="Create your first stream to get started"
          action={<Button onClick={() => setCreateOpen(true)}>Add your first stream</Button>}
        />
      )}
    </div>
  );
}
