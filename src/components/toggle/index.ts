import { type VariantProps, tv } from 'tailwind-variants';
import Root from './toggle.svelte';

export const toggleVariants = tv({
	base: 'ring-offset-background hover:bg-muted hover:text-muted-foreground focus-visible:ring-ring data-[state=on]:bg-accent data-[state=on]:text-accent-foreground inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
	variants: {
		variant: {
			default: 'bg-transparent',
			hover:
				'text-foreground !bg-transparent  hover:text-foreground opacity-50 data-[state=on]:opacity-100 data-[state=on]:bg-none hover:opacity-100 active:opacity-100 hover:bg-transparent',
			hover_link:
				'text-primary !bg-transparent underline-offset-[0.75rem] data-[state=on]:underline  hover:text-primary opacity-50 data-[state=on]:opacity-100 data-[state=on]:bg-none hover:opacity-100 active:opacity-100 hover:bg-transparent',
			outline: 'border-input hover:bg-accent hover:text-accent-foreground border bg-transparent'
		},
		size: {
			auto: 'h-auto w-auto',
			default: 'h-10 px-3',
			sm: 'h-9 px-2.5',
			lg: 'h-11 px-5',
			icon: 'h-9 w-9'
		}
	},
	defaultVariants: {
		variant: 'default',
		size: 'default'
	}
});

export type Variant = VariantProps<typeof toggleVariants>['variant'];
export type Size = VariantProps<typeof toggleVariants>['size'];

export {
	Root,
	//
	Root as Toggle
};
