'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
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
import { Play, Square } from 'lucide-react';

const createStreamSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  rtspUrl: z.string().url('Invalid URL'),
  enableDetection: z.boolean().default(false),
});

type CreateStreamFormData = z.infer<typeof createStreamSchema>;

export default function StreamsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: streams, isLoading } = useQuery({
    queryKey: ['streams'],
    queryFn: () => apiClient.listStreams().then((res) => res.data as Array<Record<string, unknown>>),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateStreamFormData>({
    resolver: zodResolver(createStreamSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateStreamFormData) => apiClient.createStream(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream created');
      reset();
      setOpen(false);
    },
    onError: (error: Record<string, unknown>) => {
      const message = (error.response as Record<string, unknown>)?.data && typeof (error.response as Record<string, unknown>).data === 'object' 
        ? ((error.response as Record<string, unknown>).data as Record<string, unknown>).message 
        : 'Failed to create stream';
      toast.error(message as string || 'Failed to create stream');
    },
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => apiClient.startStream(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream started');
    },
    onError: () => {
      toast.error('Failed to start stream');
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => apiClient.stopStream(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['streams'] });
      toast.success('Stream stopped');
    },
    onError: () => {
      toast.error('Failed to stop stream');
    },
  });

  const onSubmit = (data: CreateStreamFormData) => {
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Streams</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Manage your RTSP streams and AI detection
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Add Stream</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register New Stream</DialogTitle>
              <DialogDescription>
                Add a new RTSP stream to the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Stream Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Front Entrance"
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rtspUrl">RTSP URL</Label>
                <Input
                  id="rtspUrl"
                  placeholder="rtsp://example.com/stream"
                  {...register('rtspUrl')}
                />
                {errors.rtspUrl && (
                  <p className="text-sm text-red-500">{errors.rtspUrl.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Stream'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950 dark:border-slate-800 dark:border-t-white"></div>
        </div>
      ) : streams && streams.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {streams.map((stream: Record<string, unknown>) => (
            <Card key={stream.id as string}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{stream.name}</CardTitle>
                    <CardDescription className="mt-1">{stream.rtspUrl}</CardDescription>
                  </div>
                  <div
                    className={`h-3 w-3 rounded-full ${
                      stream.isRunning ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Status
                  </div>
                  <div className="text-sm">
                    {stream.isRunning ? 'Running' : 'Stopped'}
                  </div>
                </div>

                <div className="flex gap-2">
                  {stream.isRunning ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => stopMutation.mutate(stream.id)}
                      disabled={stopMutation.isPending}
                    >
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => startMutation.mutate(stream.id)}
                      disabled={startMutation.isPending}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Start
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={`detect-${stream.id}`} className="text-sm">
                      AI Detection
                    </Label>
                    <Switch id={`detect-${stream.id}`} defaultChecked={stream.detectionEnabled} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-slate-600 dark:text-slate-400">No streams yet</p>
              <Button className="mt-4">Add your first stream</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
