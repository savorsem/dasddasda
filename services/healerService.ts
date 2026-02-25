
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { SystemHealth, HealerLog } from '../types';
import { logEvent } from '../utils/db';

class HealerService {
    private health: SystemHealth = {
        status: 'healthy',
        lastCheck: Date.now(),
        activeErrors: 0
    };
    
    // Internal log buffer for "Real-time" debug mode
    private logs: HealerLog[] = [];
    
    private subscribers: ((health: SystemHealth) => void)[] = [];

    constructor() {
        // Start heartbeat
        setInterval(() => this.performCheckup(), 30000);
        this.addLog('info', 'Healer Agent initialized');
    }

    public subscribe(callback: (health: SystemHealth) => void) {
        this.subscribers.push(callback);
        callback(this.health);
        return () => {
            this.subscribers = this.subscribers.filter(s => s !== callback);
        };
    }

    private notify() {
        this.subscribers.forEach(cb => cb(this.health));
    }

    // Add to internal buffer
    public addLog(level: 'info' | 'warn' | 'error', message: string) {
        this.logs.unshift({ timestamp: Date.now(), level, message });
        // Keep last 100 logs
        if (this.logs.length > 100) this.logs.pop();
    }

    public getLogs(): HealerLog[] {
        return this.logs;
    }

    public reportError(error: Error | string) {
        this.health.activeErrors++;
        this.health.status = this.health.activeErrors > 5 ? 'critical' : 'degraded';
        this.notify();

        const msg = error instanceof Error ? error.message : error;
        console.warn(`[HEALER] Error detected: ${msg}`);
        
        // Add to debug log
        this.addLog('error', msg);

        // Trigger Auto-Heal if critical
        if (this.health.activeErrors > 2) {
            this.attemptAutoHeal();
        }
    }

    public async attemptAutoHeal() {
        console.log("🚑 [HEALER] Attempting auto-heal protocols...");
        this.addLog('warn', 'Attempting auto-heal protocols...');
        await logEvent('warn', 'Healer Agent Activated', { reason: 'Error threshold exceeded' });

        try {
            // Protocol 1: Clear Media Cache
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                console.log("🚑 [HEALER] Clearing Service Worker Media Cache...");
                this.addLog('info', 'Clearing SW Media Cache');
                navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_MEDIA_CACHE' });
            }

            // Protocol 2: Garbage Collect unused object URLs (simulated)
            // In a real app we might track created objectURLs in a set and revoke them here.

            // Protocol 3: Soft Reset State if critical
            this.health.activeErrors = 0;
            this.health.status = 'healthy';
            this.notify();
            
            this.addLog('info', 'System stabilized');
            await logEvent('info', 'Healer Agent Protocols Completed', { result: 'System stabilized' });

        } catch (e: any) {
            console.error("🚑 [HEALER] Failed to heal:", e);
            this.addLog('error', `Heal failed: ${e.message}`);
        }
    }

    private performCheckup() {
        // Simple decay for errors over time
        if (this.health.activeErrors > 0) {
            this.health.activeErrors = Math.max(0, this.health.activeErrors - 1);
        }
        
        if (this.health.activeErrors === 0) {
            this.health.status = 'healthy';
        }

        this.health.lastCheck = Date.now();
        
        // Check memory if available
        if ((performance as any).memory) {
             const usedJSHeapSize = (performance as any).memory.usedJSHeapSize;
             this.health.memoryUsage = Math.round(usedJSHeapSize / 1024 / 1024);
        }

        this.notify();
    }

    public getStatus() {
        return this.health;
    }
}

export const healer = new HealerService();
