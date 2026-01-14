interface Window {
  $dialog: {
    prompt: (title: string, defaultValue?: string) => Promise<string | null>;
    confirm: (message: string) => Promise<boolean>;
    alert: (message: string) => Promise<void>;
  };
}
