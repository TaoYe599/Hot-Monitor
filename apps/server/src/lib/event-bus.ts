export interface LiveEvent<TPayload = unknown> {
  type: string;
  createdAt: string;
  payload: TPayload;
}

type Listener = (event: LiveEvent) => void;

export class LiveEventBus {
  private listeners = new Set<Listener>();

  publish<TPayload>(event: LiveEvent<TPayload>): void {
    this.listeners.forEach((listener) => listener(event));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
