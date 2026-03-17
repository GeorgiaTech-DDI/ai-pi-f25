import { useForm, Controller, useWatch } from "react-hook-form"; // 1. Added useWatch
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { ArrowUp, Loader2 } from "lucide-react";
import { Field, FieldDescription } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  message: z.string().min(1),
});

export default function Chatbox({
  className,
  onSubmit,
  isLoading,
}: {
  className?: string;
  onSubmit: (val: string) => void;
  isLoading?: boolean;
}) {
  const { control, handleSubmit, reset } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: "" },
  });

  const onInternalSubmit = (data: z.infer<typeof formSchema>) => {
    onSubmit(data.message);
    reset();
  };

  const messageValue = useWatch({
    control,
    name: "message",
    defaultValue: "",
  });

  const hasInput = messageValue.trim().length > 0;

  return (
    <form
      onSubmit={handleSubmit(onInternalSubmit)}
      className={cn(
        "w-[44vw] dark:bg-secondary rounded-md p-4 flex flex-col items-end gap-y-4",
        className,
      )}
    >
      <Controller
        name="message"
        control={control}
        render={({ field }) => (
          <Field className={cn("flex-1 w-full")}>
            <Textarea
              {...field}
              id={field.name}
              placeholder="Ask AI PI"
              className={cn(
                "min-h-[40px] resize-none border-none shadow-none focus-visible:ring-0 dark:bg-transparent !text-base",
              )}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(onInternalSubmit)();
                }
              }}
            />
            <FieldDescription className="sr-only">
              Type your message and press enter to send.
            </FieldDescription>
          </Field>
        )}
      />
      <Button
        type="submit"
        variant="default"
        size="icon"
        className="hover:brightness-90"
        disabled={!hasInput}
        tooltip={hasInput ? "Send message" : "Type a message"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 pointer-events-none animate-spin" />
        ) : (
          <ArrowUp className="h-4 w-4 pointer-events-none" />
        )}
      </Button>
    </form>
  );
}
