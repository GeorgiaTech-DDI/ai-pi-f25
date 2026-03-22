"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),

      }}
      style={
        {
          "--normal-bg": "var(--color-secondary)",
          "--normal-text": "var(--color-secondary-foreground)",
          "--normal-border": "var(--color-secondary)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
        actionButtonStyle: {
          "background-color": "var(--color-primary)",
          "--normal-text": "var(--color-secondary-foreground)",
          "--normal-border": "var(--color-secondary)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }}
      {...props}
    />
  )
}

export { Toaster }
