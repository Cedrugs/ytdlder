export interface DropdownProps  {
    options: DropdownOption[];
    defaultValue?: string;
    onChange?: (value: number) => void;
};

export interface DropdownOption {
    label: string;
    value: number;
}