import * as mediasoup from 'mediasoup';
import type { Worker, Router } from 'mediasoup/types';
import pino from 'pino';

const logger = pino({ name: 'mediasoup-manager' });

let workers: Worker[] = [];
let nextWorkerIndex = 0;

const NUM_WORKERS = 1; // increase in production

/**
 * Initialize mediasoup workers. Call once on server boot.
 */
export async function initMediasoupWorkers(): Promise<void> {
  const os = await import('node:os');
  const numCpus = os.availableParallelism?.() || os.cpus().length;
  const count = Math.min(NUM_WORKERS, Math.max(1, numCpus - 1));

  for (let i = 0; i < count; i++) {
    const rtcMinPort = parseInt(process.env.MEDIASOUP_RTC_MIN_PORT || '40000', 10);
    const rtcMaxPort = parseInt(process.env.MEDIASOUP_RTC_MAX_PORT || '49999', 10);
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort,
      rtcMaxPort,
    });

    worker.on('died', () => {
      logger.error({ workerId: worker.pid }, 'mediasoup Worker died, exiting');
      process.exit(1);
    });

    workers.push(worker);
    logger.info({ pid: worker.pid, index: i }, 'mediasoup Worker created');
  }
}

/**
 * Get a worker using round-robin load balancing.
 */
function getWorker(): Worker {
  const worker = workers[nextWorkerIndex % workers.length];
  nextWorkerIndex++;
  return worker;
}

/**
 * Create a new mediasoup Router for a room.
 */
export async function createRouter(): Promise<Router> {
  const worker = getWorker();
  const router = await worker.createRouter({
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/H264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0032',
          'level-asymmetry-allowed': 1,
        },
      },
    ],
  });

  logger.info({ routerId: router.id }, 'mediasoup Router created');
  return router;
}

/**
 * Gracefully close all workers on shutdown.
 */
export async function closeMediasoupWorkers(): Promise<void> {
  for (const worker of workers) {
    worker.close();
  }
  workers = [];
  logger.info('All mediasoup workers closed');
}
