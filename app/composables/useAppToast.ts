export function useAppToast() {
  const toast = useToast();
  const position = "topRight" as const;

  const success = (message: string) => {
    toast.success({
      title: "Success",
      message,
      position,
    });
  };

  const error = (message: string) => {
    toast.error({
      title: "Error",
      message,
      position,
    });
  };

  return {
    success,
    error,
  };
}
