export function useGlobalLoading() {
  const pendingCount = useState<number>("global-loading:count", () => 0);
  const message = useState<string>("global-loading:message", () => "กำลังโหลด...");

  const isLoading = computed(() => pendingCount.value > 0);

  const start = (nextMessage = "กำลังโหลด...") => {
    message.value = nextMessage;
    pendingCount.value += 1;
  };

  const finish = () => {
    pendingCount.value = Math.max(0, pendingCount.value - 1);
    if (pendingCount.value === 0) {
      message.value = "กำลังโหลด...";
    }
  };

  const track = async <T>(task: () => Promise<T>, nextMessage?: string): Promise<T> => {
    start(nextMessage);
    try {
      return await task();
    } finally {
      finish();
    }
  };

  return {
    pendingCount,
    isLoading,
    message,
    start,
    finish,
    track,
  };
}
