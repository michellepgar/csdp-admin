import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none shadow-sm shadow-black/15 hover:shadow-md active:shadow-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:shadow-black/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        // Solid buttons: a soft top-to-bottom sheen, a light inner edge and a
        // short shadow, so they read as raised and pressable rather than flat.
        default: "bg-linear-to-b from-ring to-ring/85 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(0_0_0/0.25)] hover:-translate-y-px hover:brightness-110 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_4px_10px_-2px_rgb(0_0_0/0.3)]",
        plan: "bg-linear-to-b from-plan-accent to-plan-accent/85 text-plan-accent-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(0_0_0/0.25)] hover:-translate-y-px hover:brightness-110 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_4px_10px_-2px_rgb(0_0_0/0.3)]",
        outline:
          "border-ring/60 bg-linear-to-b from-card to-ring/5 text-ring shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(0_0_0/0.1)] hover:-translate-y-px hover:border-ring hover:from-ring/10 hover:to-ring/15 hover:shadow-[0_4px_10px_-3px_rgb(0_0_0/0.2)] aria-expanded:bg-ring/10 dark:from-input/40 dark:to-input/20 dark:text-ring dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.4)]",
        secondary:
          "bg-linear-to-b from-ring/15 to-ring/10 text-ring shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:from-ring/25 hover:to-ring/15 aria-expanded:bg-ring/20",
        ghost:
          "shadow-none hover:shadow-none hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "shadow-none hover:shadow-none text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-2xs":
          "size-5 rounded-[min(var(--radius-md),8px)] text-[0.65rem] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-2.5",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    compoundVariants: [
      // A text ghost button (Cancel, Close, Back...) gets a soft resting tint
      // and hairline so it still looks like a button. Icon-only ghosts (the
      // ✕ and pencil buttons) stay bare.
      { variant: "ghost", size: ["default", "xs", "sm", "lg"], className: "border-border/70 bg-linear-to-b from-card/80 to-muted/60 text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_1px_rgb(0_0_0/0.06)] hover:border-ring/40 hover:from-muted/60 hover:to-muted dark:from-input/30 dark:to-input/10 dark:shadow-none" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
