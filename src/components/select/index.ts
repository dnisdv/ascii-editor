import { Select as SelectPrimitive } from 'bits-ui';
import Content from './select-content.svelte';
import Item from './select-item.svelte';
import Trigger from './select-trigger.svelte';

const Root = SelectPrimitive.Root;
const Value = SelectPrimitive.Value;
const Group = SelectPrimitive.Group;
const Label = SelectPrimitive.Label;
const Separator = SelectPrimitive.Separator;

export {
	Root,
	Value,
	Content,
	Item,
	Trigger,
	Group,
	Label,
	Separator,
	Root as SelectRoot,
	Value as SelectValue,
	Content as SelectContent,
	Item as SelectItem,
	Trigger as SelectTrigger,
};
