/**
 * Registers the shared BullMQ connection once, app-wide, so any feature module
 * can `BullModule.registerQueue(...)` as a producer. The API only ever produces
 * jobs; consumers live in apps/worker.
 */
export declare class QueueRootModule {
}
