
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DateTimePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  disabled?: boolean;
}

export function DateTimePicker({
  date,
  setDate,
  disabled = false,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(date);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

  // Generate hours and minutes
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, "0"));

  // Update parent state when local state changes
  useEffect(() => {
    if (selectedDate) {
      setDate(selectedDate);
    }
  }, [selectedDate]);

  // Update local state when parent date changes
  useEffect(() => {
    if (date) {
      setSelectedDate(date);
    }
  }, [date]);

  const handleSelectDate = (date?: Date) => {
    if (date) {
      // Preserve time information
      const newDate = new Date(date);
      
      if (selectedDate) {
        newDate.setHours(
          selectedDate.getHours(),
          selectedDate.getMinutes(),
          selectedDate.getSeconds(),
          selectedDate.getMilliseconds()
        );
      }
      
      setSelectedDate(newDate);
    }
  };

  const handleSelectHour = (hour: string) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(parseInt(hour));
      setSelectedDate(newDate);
    }
  };

  const handleSelectMinute = (minute: string) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setMinutes(parseInt(minute));
      setSelectedDate(newDate);
    }
  };

  const formatDisplayDateTime = () => {
    if (!selectedDate) return "";
    return format(selectedDate, "PPP p");
  };

  return (
    <div className="flex gap-2">
      <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={"outline"}
            className={cn(
              "justify-start text-left font-normal w-[280px]",
              !selectedDate && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDisplayDateTime()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              handleSelectDate(date);
              setIsDatePickerOpen(false);
              setIsTimePickerOpen(true);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      <Popover open={isTimePickerOpen} onOpenChange={setIsTimePickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-[100px]")} disabled={disabled}>
            <Clock className="mr-2 h-4 w-4" />
            {selectedDate ? format(selectedDate, "p") : "Time"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4">
          <div className="flex gap-2">
            {/* Hours */}
            <Select
              value={selectedDate ? selectedDate.getHours().toString().padStart(2, "0") : undefined}
              onValueChange={handleSelectHour}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="Hour" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                <SelectGroup>
                  {hours.map((hour) => (
                    <SelectItem key={hour} value={hour}>
                      {hour}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <span className="flex items-center">:</span>

            {/* Minutes */}
            <Select
              value={selectedDate ? selectedDate.getMinutes().toString().padStart(2, "0") : undefined}
              onValueChange={handleSelectMinute}
            >
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="Min" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] overflow-y-auto">
                <SelectGroup>
                  {minutes.map((minute) => (
                    <SelectItem key={minute} value={minute}>
                      {minute}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 text-right">
            <Button 
              size="sm" 
              onClick={() => setIsTimePickerOpen(false)}
              className="bg-astra-red hover:bg-red-600 text-white"
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
