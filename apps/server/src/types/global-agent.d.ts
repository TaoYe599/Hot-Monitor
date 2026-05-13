declare module "global-agent" {
  export function bootstrap(options?: {
    environmentVariableNamespace?: string;
    socketConnectionTimeout?: number;
    maxSockets?: number;
    logger?: (message: string) => void;
  }): void;
}
