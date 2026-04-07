export function useAppToast() {
  const toast = useToast();
  const position = "topRight" as const;

  const resolveErrorMessage = (input: unknown, fallback = "เกิดข้อผิดพลาด") => {
    if (input instanceof Error && input.message.trim()) return input.message.trim();
    if (typeof input === "string" && input.trim()) return input.trim();
    return fallback;
  };

  const success = (message: string) => {
    toast.success({
      title: "สำเร็จ",
      message,
      position,
    });
  };

  const error = (input: unknown, fallback?: string) => {
    toast.error({
      title: "เกิดข้อผิดพลาด",
      message: resolveErrorMessage(input, fallback),
      position,
    });
  };

  return {
    success,
    error,
    resolveErrorMessage,
  };
}
