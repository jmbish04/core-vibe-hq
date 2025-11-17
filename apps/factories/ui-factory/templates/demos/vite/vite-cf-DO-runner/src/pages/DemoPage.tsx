import { useState, useEffect } from 'react';
import { ArrowLeft, Database, Cpu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import type { DemoItem, ApiResponse } from '@shared/types';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AppLayout } from '@/components/layout/AppLayout';

export function DemoPage() {
  const [counter, setCounter] = useState<number>(0);
  const [demoItems, setDemoItems] = useState<DemoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/counter').then(res => res.json()),
      fetch('/api/demo').then(res => res.json())
    ]).then(([counterData, itemsData]: [ApiResponse<number>, ApiResponse<DemoItem[]>]) => {
      if (counterData.success) setCounter(counterData.data || 0);
      if (itemsData.success) setDemoItems(itemsData.data || []);
      setLoading(false);
    });
  }, []);

  const incrementCounter = async () => {
    const res = await fetch('/api/counter/increment', { method: 'POST' });
    const data = await res.json() as ApiResponse<number>;
    if (data.success && data.data !== undefined) {
      setCounter(data.data);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </main>
    );
  }

  return (
    <AppLayout>
      <main className="min-h-screen bg-background p-6">
        <ThemeToggle />
        
        <div className="max-w-4xl mx-auto space-y-6">
            <header className="space-y-2">
            <Link to="/">
                <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
                </Button>
            </Link>
            <h1 className="text-3xl font-bold">Workers Demo</h1>
            <p className="text-muted-foreground">Simple showcase of Durable Object persistence</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Durable Object Storage Demo */}
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    Durable Object Storage
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                    Persistent data stored in Durable Object:
                </p>
                {demoItems.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-2 border rounded">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">Value: {item.value}</span>
                    </div>
                ))}
                </CardContent>
            </Card>

            {/* Counter Demo */}
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-green-500" />
                    Durable Object Counter
                </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                <div className="text-center">
                    <p className="text-4xl font-bold">{counter}</p>
                    <p className="text-sm text-muted-foreground">Current Counter Value</p>
                </div>
                <Button 
                    onClick={incrementCounter}
                    className="w-full"
                    variant="outline"
                >
                    Increment Counter
                </Button>
                </CardContent>
            </Card>
            </div>
        </div>
      </main>
    </AppLayout>
  );
}
