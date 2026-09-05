'use client';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
export function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger
        aria-label={label}
        data-platform={value}
        className="picker"
      >
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v} data-platform={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Help({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger aria-label={text} className="help">
        <Info size={13} />
      </TooltipTrigger>
      <TooltipContent className="max-w-72">{text}</TooltipContent>
    </Tooltip>
  );
}
