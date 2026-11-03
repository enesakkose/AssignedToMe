import { AppHeader } from "@/components/layout/app-header";
import { Screen } from "@/components/layout/screen";
import { Section } from "@/components/layout/section";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetModal,
  type BottomSheetModalRef,
} from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormCheckbox,
  FormInput,
  FormSelect,
  FormSwitch,
  FormTextarea,
} from "@/components/ui/form";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { NativeOnlyAnimatedView } from "@/components/ui/native-only-animated-view";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
  type Option,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAppTheme } from "@/hooks/use-app-theme";
import { APP_FONT_FAMILY } from "@/lib/theme";
import { zodResolver } from "@hookform/resolvers/zod";
import { FlashList } from "@shopify/flash-list";
import { OTPInput } from "input-otp-native";
import {
  Activity,
  Bell,
  Box,
  Check,
  Code2,
  GripVertical,
  Info,
  Layers,
  MessageSquare,
  PanelTop,
  Settings2,
  Terminal,
  Wand2,
} from "lucide-react-native";
import { NumberFlow } from "number-flow-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { View } from "react-native";
import { FadeInDown } from "react-native-reanimated";
import { Sortable, SortableItem, type SortableRenderItemProps } from "react-native-reanimated-dnd";
import { toast } from "sonner-native";
import { z } from "zod";

type Task = {
  id: string;
  title: string;
};

const componentGroups = [
  {
    id: "foundation",
    items: ["Text", "Icon", "Separator", "AspectRatio", "Skeleton"],
    title: "Foundation",
  },
  {
    id: "actions",
    items: ["Button", "Badge", "Toggle", "ToggleGroup", "Tooltip"],
    title: "Actions",
  },
  {
    id: "forms",
    items: ["Input", "Textarea", "Label", "Checkbox", "Switch", "RadioGroup", "Select"],
    title: "Forms",
  },
  {
    id: "surfaces",
    items: ["Card", "Alert", "Avatar", "Progress", "Tabs", "Accordion", "Collapsible"],
    title: "Surfaces",
  },
  {
    id: "overlays",
    items: [
      "AlertDialog",
      "ContextMenu",
      "Dialog",
      "DropdownMenu",
      "HoverCard",
      "Menubar",
      "Popover",
    ],
    title: "Overlays",
  },
  {
    id: "native",
    items: [
      "NativeOnlyAnimatedView",
      "BottomSheet",
      "NumberFlow",
      "OTPInput",
      "FlashList",
      "ReanimatedDnD",
    ],
    title: "Native extras",
  },
];

const flashItems = Array.from({ length: 80 }, (_, index) => ({
  id: `item-${index + 1}`,
  label: `Virtual row ${index + 1}`,
}));

const initialTasks: Task[] = [
  { id: "1", title: "Design tokens" },
  { id: "2", title: "Generic providers" },
  { id: "3", title: "Feature routes" },
];

const selectOptions: NonNullable<Option>[] = [
  { label: "Native app shell", value: "shell" },
  { label: "Feature screen", value: "feature" },
  { label: "Reusable pattern", value: "pattern" },
];

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Invalid email address."),
  bio: z.string().max(200, "Bio must be under 200 characters."),
  type: z.string().min(1, "Select a type."),
  terms: z.boolean().refine((value) => value === true, { message: "You must accept the terms." }),
  newsletter: z.boolean().optional(),
  notifications: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

const tokenSwatches = [
  { className: "bg-paper", label: "paper" },
  { className: "bg-paper-2", label: "paper-2" },
  { className: "bg-paper-3", label: "paper-3" },
  { className: "bg-ink", label: "ink" },
  { className: "bg-primary", label: "accent" },
  { className: "bg-error", label: "error" },
  { className: "bg-success", label: "success" },
  { className: "bg-progress", label: "progress" },
  { className: "bg-warning", label: "warning" },
];

export function PlaygroundScreen() {
  const theme = useAppTheme();
  const mutedInk = theme.values.mutedInk;
  const surfaceColor = theme.values.surface;
  const bottomSheetRef = useRef<BottomSheetModalRef>(null);
  const [checked, setChecked] = useState(false);
  const [collapsibleOpen, setCollapsibleOpen] = useState(true);
  const [count, setCount] = useState(1240);
  const [density, setDensity] = useState("compact");
  const [otp, setOtp] = useState("");
  const [radioValue, setRadioValue] = useState("native");
  const [selectedOption, setSelectedOption] = useState<Option>(selectOptions[0]);
  const [tabsValue, setTabsValue] = useState("tokens");
  const [menubarValue, setMenubarValue] = useState<string | undefined>(undefined);
  const [tasks] = useState(initialTasks);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bio: "",
      email: "",
      name: "",
      newsletter: false,
      notifications: true,
      terms: false,
      type: "",
    },
  });

  function onSubmit(values: FormValues) {
    toast.success("Form submitted", {
      description: JSON.stringify(values, null, 2),
    });
  }

  function onInvalid() {
    toast.error("Validation failed", {
      description: "Check the fields above.",
    });
  }

  const catalog = useMemo(() => componentGroups, []);

  const renderTask = useCallback(
    (props: SortableRenderItemProps<Task>) => {
      const { id, item, ...rest } = props;

      return (
        <SortableItem key={id} data={item} id={id} {...rest}>
          <View className="h-16 flex-row items-center justify-between rounded-lg border border-border bg-card px-4">
            <View className="flex-row items-center gap-3">
              <View className="size-9 items-center justify-center rounded-full bg-surface">
                <Icon as={Layers} className="text-muted-foreground" size={17} />
              </View>
              <Text className="text-base font-medium">{item.title}</Text>
            </View>
            <SortableItem.Handle>
              <View className="rounded-full bg-surface p-2">
                <GripVertical color={mutedInk} size={18} />
              </View>
            </SortableItem.Handle>
          </View>
        </SortableItem>
      );
    },
    [mutedInk],
  );

  return (
    <Screen
      header={
        <AppHeader
          subtitle="Every primitive in its states, on the same tokens as the desktop app."
          title="Playground"
        />
      }
    >
      <Section
        description="Achromatic by default: hue appears only for state (error, done, in progress)."
        flush
        title="Tokens"
      >
        <View>
          {tokenSwatches.map((item) => (
            <View
              className="h-12 flex-row items-center justify-between border-t border-rule px-5"
              key={item.label}
            >
              <Text className="font-mono text-sm">{item.label}</Text>
              <View className={`cut h-7 w-20 border border-rule ${item.className}`} />
            </View>
          ))}
        </View>
      </Section>

      <Section
        description="Grouped inventory for every primitive and native extra included in the base."
        title="Primitive catalog"
      >
        <View className="gap-3">
          {catalog.map((group) => (
            <View className="gap-3 rounded-md bg-surface p-4" key={group.id}>
              <Text className="text-base font-semibold">{group.title}</Text>
              <View className="flex-row flex-wrap gap-2">
                {group.items.map((item) => (
                  <Badge className="border-border bg-card" key={item} variant="outline">
                    <Text>{item}</Text>
                  </Badge>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Core controls">
        <View className="flex-row flex-wrap gap-2">
          <Button onPress={() => toast.success("Primary action")}>
            <Icon as={Check} className="text-primary-foreground" size={16} />
            <Text>Primary</Text>
          </Button>
          <Button variant="secondary">
            <Icon as={Settings2} size={16} />
            <Text>Secondary</Text>
          </Button>
          <Button variant="outline">
            <Icon as={Code2} size={16} />
            <Text>Outline</Text>
          </Button>
          <Button size="icon" variant="ghost">
            <Icon as={Bell} size={18} />
          </Button>
        </View>

        <View className="gap-2">
          <Label nativeID="sample-input">Label + Input</Label>
          <Input aria-labelledby="sample-input" placeholder="Reusable input" />
          <Textarea placeholder="Textarea for longer product notes" />
        </View>

        <View className="flex-row flex-wrap items-center gap-4">
          <View className="flex-row items-center gap-2">
            <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
            <Text>Checkbox</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Switch checked={checked} onCheckedChange={setChecked} />
            <Text>Switch</Text>
          </View>
          <Toggle pressed={checked} onPressedChange={setChecked}>
            <Icon as={Wand2} size={15} />
            <Text>Toggle</Text>
          </Toggle>
        </View>

        <ToggleGroup
          onValueChange={(value) => value && setDensity(value)}
          type="single"
          value={density}
        >
          <ToggleGroupItem value="compact">
            <Text>Compact</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="balanced">
            <Text>Balanced</Text>
          </ToggleGroupItem>
          <ToggleGroupItem value="roomy">
            <Text>Roomy</Text>
          </ToggleGroupItem>
        </ToggleGroup>
      </Section>

      <Section title="Feedback and content">
        <Alert icon={Terminal}>
          <AlertTitle>Generic feedback</AlertTitle>
          <AlertDescription>
            Alerts, badges, progress and skeleton states use the shared tokens.
          </AlertDescription>
        </Alert>

        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <View className="flex-row items-center justify-between gap-3">
              <View>
                <CardTitle>Card title</CardTitle>
                <CardDescription>
                  Cards are reserved for repeated records and framed tools.
                </CardDescription>
              </View>
              <Avatar alt="RN Base">
                <AvatarFallback>
                  <Text>RB</Text>
                </AvatarFallback>
              </Avatar>
            </View>
          </CardHeader>
          <CardContent className="gap-3">
            <View className="flex-row flex-wrap gap-2">
              <Badge>
                <Text>Default badge</Text>
              </Badge>
              <Badge variant="secondary">
                <Text>Secondary</Text>
              </Badge>
              <Badge variant="outline">
                <Text>Outline</Text>
              </Badge>
            </View>
            <Progress value={64} />
            <Skeleton className="h-12 rounded-md" />
            <Separator />
            <View className="flex-row items-center gap-2">
              <Icon as={Info} className="text-muted-foreground" size={16} />
              <Text variant="muted">Icon primitive wraps lucide-react-native with NativeWind.</Text>
            </View>
          </CardContent>
        </Card>

        <AspectRatio ratio={16 / 9}>
          <View className="flex-1 items-center justify-center rounded-md border border-border bg-muted">
            <Icon as={PanelTop} className="text-muted-foreground" size={22} />
            <Text className="mt-2" variant="muted">
              AspectRatio surface
            </Text>
          </View>
        </AspectRatio>
      </Section>

      <Section title="Disclosure">
        <Accordion collapsible type="single">
          <AccordionItem value="theme">
            <AccordionTrigger>
              <Text>Accordion: theme tokens</Text>
            </AccordionTrigger>
            <AccordionContent>
              <Text variant="muted">
                NativeWind CSS variables, navigation theme and DESIGN.md stay aligned.
              </Text>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline">
              <Text>{collapsibleOpen ? "Hide" : "Show"} collapsible notes</Text>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <View className="mt-3 rounded-md border border-border bg-card p-3">
              <Text variant="muted">
                Collapsible content is useful for product details without changing route context.
              </Text>
            </View>
          </CollapsibleContent>
        </Collapsible>

        <Tabs onValueChange={setTabsValue} value={tabsValue}>
          <TabsList>
            <TabsTrigger value="tokens">
              <Text>Tokens</Text>
            </TabsTrigger>
            <TabsTrigger value="motion">
              <Text>Motion</Text>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tokens">
            <Text variant="muted">
              Neutral surfaces, contrast-led primary and restrained accents.
            </Text>
          </TabsContent>
          <TabsContent value="motion">
            <Text variant="muted">Native animations should favor transform and opacity.</Text>
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Menus and overlays">
        <View className="flex-row flex-wrap gap-2">
          <Button onPress={() => bottomSheetRef.current?.present()} variant="outline">
            <Text>BottomSheet</Text>
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Text>Dialog</Text>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dialog primitive</DialogTitle>
                <DialogDescription>
                  Use dialogs for focused decisions, not for routine navigation.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button>
                  <Text>Done</Text>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Text>AlertDialog</Text>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset playground?</AlertDialogTitle>
                <AlertDialogDescription>
                  Destructive confirmation flows use the alert dialog primitive.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  <Text>Cancel</Text>
                </AlertDialogCancel>
                <AlertDialogAction>
                  <Text>Continue</Text>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Text>Dropdown</Text>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Text>Open command</Text>
                <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Text>Archive</Text>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Text>Popover</Text>
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <Text className="font-medium">Popover primitive</Text>
              <Text variant="muted">Small contextual controls and metadata live here.</Text>
            </PopoverContent>
          </Popover>

          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="outline">
                <Text>HoverCard</Text>
              </Button>
            </HoverCardTrigger>
            <HoverCardContent>
              <Text className="font-medium">Hover preview</Text>
              <Text variant="muted">
                On native, this behaves through pressable overlay primitives.
              </Text>
            </HoverCardContent>
          </HoverCard>
        </View>

        <ContextMenu>
          <ContextMenuTrigger>
            <View className="h-20 justify-center rounded-md border border-dashed border-border bg-card px-4">
              <Text>ContextMenu trigger area</Text>
              <Text variant="muted">Long press or secondary click depending on platform.</Text>
            </View>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Canvas</ContextMenuLabel>
            <ContextMenuSeparator />
            <ContextMenuItem>
              <Text>Duplicate</Text>
              <ContextMenuShortcut>⌘D</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Text>Inspect</Text>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <Menubar onValueChange={setMenubarValue} value={menubarValue}>
          <MenubarMenu value="file">
            <MenubarTrigger>
              <Text>File</Text>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                <Text>New feature</Text>
                <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                <Text>Run checks</Text>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu value="view">
            <MenubarTrigger>
              <Text>View</Text>
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                <Text>Playground</Text>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>

        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline">
              <Icon as={MessageSquare} size={17} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <Text>Tooltip primitive</Text>
          </TooltipContent>
        </Tooltip>

        <BottomSheetModal ref={bottomSheetRef}>
          <BottomSheetContent>
            <BottomSheetHeader
              description="Gesture-driven native sheet for contextual tasks and compact flows."
              title="Bottom sheet"
            />
            <View className="gap-3 rounded-md bg-surface p-4">
              <View className="flex-row items-center gap-3">
                <View className="size-10 items-center justify-center rounded-full bg-card">
                  <Icon as={PanelTop} className="text-muted-foreground" size={18} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">Sheet surface</Text>
                  <Text variant="muted">Provider lives once in AppProviders.</Text>
                </View>
              </View>
              <Button onPress={() => bottomSheetRef.current?.dismiss()}>
                <Text>Dismiss</Text>
              </Button>
            </View>
          </BottomSheetContent>
        </BottomSheetModal>
      </Section>

      <Section title="Choice controls">
        <RadioGroup onValueChange={setRadioValue} value={radioValue}>
          <View className="flex-row items-center gap-2">
            <RadioGroupItem value="native" />
            <Text>Native-first</Text>
          </View>
          <View className="flex-row items-center gap-2">
            <RadioGroupItem value="generic" />
            <Text>Generic base</Text>
          </View>
        </RadioGroup>

        <Select
          onValueChange={(option) => option && setSelectedOption(option)}
          value={selectedOption}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select surface" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Surface type</SelectLabel>
              {selectOptions.map((option) => (
                <SelectItem key={option.value} label={option.label} value={option.value}>
                  <Text>{option.label}</Text>
                </SelectItem>
              ))}
              <SelectSeparator />
            </SelectGroup>
          </SelectContent>
        </Select>
      </Section>

      <Section description="RHF + Zod form wrappers" title="Form wrappers">
        <Form form={form}>
          <View className="gap-4">
            <FormInput
              control={form.control}
              keyboardType="email-address"
              label="Name"
              name="name"
              placeholder="Enter your name"
            />
            <FormInput
              autoCapitalize="none"
              control={form.control}
              keyboardType="email-address"
              label="Email"
              name="email"
              placeholder="you@company.com"
            />
            <FormTextarea
              control={form.control}
              label="Bio"
              name="bio"
              placeholder="Short bio (max 200 chars)"
            />
            <FormSelect
              control={form.control}
              label="Type"
              name="type"
              options={selectOptions}
              placeholder="Select a type"
            />
            <FormCheckbox control={form.control} label="Accept terms" name="terms" />
            <FormSwitch
              control={form.control}
              description="Receive product updates"
              label="Newsletter"
              name="newsletter"
            />
            <FormSwitch
              control={form.control}
              description="Push notifications enabled"
              label="Notifications"
              name="notifications"
            />
            <Button
              onPress={() => {
                void form.handleSubmit(onSubmit, onInvalid)();
              }}
            >
              <Text>Submit</Text>
            </Button>
          </View>
        </Form>
      </Section>

      <Section description="NumberFlow animates numeric changes." title="NumberFlow">
        <View className="flex-row items-center justify-between gap-4 rounded-md border border-border bg-surface p-4">
          <View>
            <Text variant="muted">Animated metric</Text>
            <NumberFlow
              value={count}
              style={{
                color: theme.tokens.foreground,
                fontFamily: APP_FONT_FAMILY.semiBold,
                fontSize: 42,
                fontWeight: "600",
              }}
            />
          </View>
          <Button onPress={() => setCount((value) => value + 137)}>
            <Text>Increase</Text>
          </Button>
        </View>
      </Section>

      <Section description="input-otp-native powers the one-time-password control." title="OTP">
        <OTPInput
          keyboardType="number-pad"
          maxLength={6}
          onChange={setOtp}
          render={({ slots }) => (
            <View className="flex-row gap-2">
              {slots.map((slot, index) => (
                <Button
                  className="h-12 w-11 border-border bg-card"
                  key={index}
                  onPress={slot.focus}
                  variant={slot.isActive ? "default" : "outline"}
                >
                  <Text>{slot.char ?? ""}</Text>
                </Button>
              ))}
            </View>
          )}
          value={otp}
        />
      </Section>

      <Section description="FlashList is the native virtualization default." title="FlashList">
        <View className="h-64 rounded-md border border-border bg-card">
          <FlashList
            data={flashItems}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View className="h-12 justify-center border-b border-border px-4">
                <Text>{item.label}</Text>
              </View>
            )}
          />
        </View>
      </Section>

      <Section
        description="React Native Reanimated DnD replaces dnd kit for native-only work."
        title="Drag and drop"
      >
        <View
          className="overflow-hidden rounded-md border border-border bg-surface p-2"
          style={{ backgroundColor: surfaceColor }}
        >
          <Sortable
            contentContainerStyle={{ backgroundColor: "transparent" }}
            data={tasks}
            gap={8}
            itemHeight={64}
            renderItem={renderTask}
            style={{ backgroundColor: "transparent", height: 216 }}
            useFlatList={false}
          />
        </View>
      </Section>

      <Section title="Native motion and notifications">
        <NativeOnlyAnimatedView entering={FadeInDown.duration(220)}>
          <View className="flex-row items-center gap-3 rounded-lg border border-border bg-card p-4">
            <Icon as={Activity} className="text-muted-foreground" size={18} />
            <Text className="flex-1 leading-6">
              NativeOnlyAnimatedView renders animated surfaces on iOS/Android.
            </Text>
          </View>
        </NativeOnlyAnimatedView>
        <Button
          onPress={() =>
            toast.info("Sonner Native is wired", {
              description: "The Toaster lives in AppProviders.",
            })
          }
        >
          <Icon as={Box} className="text-primary-foreground" size={16} />
          <Text>Show toast</Text>
        </Button>
      </Section>
    </Screen>
  );
}
