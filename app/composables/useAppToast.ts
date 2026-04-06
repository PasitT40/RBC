export function useAppToast() {
  const toast = useToast();
  const position = "topRight" as const;

  const success = (message: string) => {
    toast.success({
      title: "สำเร็จ",
      message,
      position,
    });
  };

  const error = (message: string) => {
    toast.error({
      title: "เกิดข้อผิดพลาด",
      message,
      position,
    });
  };

  return {
    success,
    error,
  };
}
