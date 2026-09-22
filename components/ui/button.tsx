import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none shadow-sm shadow-black/15 hover:shadow-md active:shadow-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:shadow-black/40 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        // Solid buttons: a flat fill with a light inner edge and a short
        // shadow so they still read as raised and pressable; the color
        // itself only changes on hover/active, no gradient sheen.
        default: "bg-ring text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(0_0_0/0.25)] hover:-translate-y-px hover:bg-ring/90 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_4px_10px_-2px_rgb(0_0_0/0.3)] active:bg-ring/80",
        plan: "bg-plan-accent text-plan-accent-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_1px_2px_rgb(0_0_0/0.25)] hover:-translate-y-px hover:bg-plan-accent/90 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.28),0_4px_10px_-2px_rgb(0_0_0/0.3)] active:bg-plan-accent/80",
        outline:
          "border-ring/60 bg-card text-ring shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_1px_2px_rgb(0_0_0/0.1)] hover:-translate-y-px hover:border-ring hover:bg-ring/10 hover:shadow-[0_4px_10px_-3px_rgb(0_0_0/0.2)] active:bg-ring/15 aria-expanded:bg-ring/10 dark:bg-input/30 dark:text-ring dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.4)]",
        secondary:
          "bg-ring/12 text-ring shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] hover:bg-ring/20 active:bg-ring/28 aria-expanded:bg-ring/20",
        ghost:
          "shadow-none hover:shadow-none hover:bg-muted hover:text-foreground active:bg-muted/70 aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 active:bg-destructive/30 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:active:bg-destructive/40 dark:focus-visible:ring-destructive/40",
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
      { variant: "ghost", size: ["default", "xs", "sm", "lg"], className: "border-border/70 bg-muted/50 text-foreground/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_1px_rgb(0_0_0/0.06)] hover:border-ring/40 hover:bg-muted active:bg-muted/80 dark:bg-input/20 dark:shadow-none" },
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
