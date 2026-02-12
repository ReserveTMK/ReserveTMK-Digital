import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/beautiful-button";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { Plus, Search, Filter, Loader2, User } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContactSchema } from "@shared/schema";
import type { z } from "zod";

type ContactFormValues = z.infer<typeof insertContactSchema>;

export default function Contacts() {
  const { data: contacts, isLoading } = useContacts();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(search.toLowerCase()) || 
                          contact.businessName?.toLowerCase().includes(search.toLowerCase()) ||
                          contact.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || contact.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="flex min-h-screen bg-background/50">
      <Sidebar />
      <main className="flex-1 md:ml-72 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold">Community</h1>
              <p className="text-muted-foreground mt-1">Manage your mentees and network.</p>
            </div>
            
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-lg">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Member
                </Button>
              </DialogTrigger>
              <CreateContactDialogContent onSuccess={() => setOpen(false)} />
            </Dialog>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search by name or email..." 
                className="pl-10 h-11 bg-card rounded-xl border-border/60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-card border-border/60">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Filter by Role" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Mentee">Mentee</SelectItem>
                  <SelectItem value="Business Owner">Business Owner</SelectItem>
                  <SelectItem value="Innovator">Innovator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contacts Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredContacts?.length === 0 ? (
            <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <UsersIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No community members found</h3>
              <p className="text-muted-foreground mb-6">Try adjusting your filters or add a new member.</p>
              <Button onClick={() => setOpen(true)} variant="outline">Add Member</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContacts?.map((contact) => (
                <Link key={contact.id} href={`/contacts/${contact.id}`}>
                  <div className="group bg-card hover:bg-card/80 border border-border rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer h-full flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl group-hover:scale-110 transition-transform">
                        {contact.name[0]}
                      </div>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        {contact.role}
                      </span>
                    </div>
                    
                    <h3 className="text-xl font-bold font-display text-foreground mb-1 group-hover:text-primary transition-colors">
                      {contact.name}
                    </h3>
                    {contact.businessName && (
                      <p className="text-sm text-foreground/70 truncate" data-testid={`text-business-${contact.id}`}>{contact.businessName}</p>
                    )}
                    <p className="text-sm text-muted-foreground mb-4 truncate">{contact.email || "No email"}</p>
                    
                    <div className="mt-auto pt-4 border-t border-border/50 flex flex-wrap gap-2">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag, i) => (
                          <span key={i} className="text-xs px-2 py-1 bg-muted rounded-md text-muted-foreground">
                            #{tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No tags</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const ETHNIC_GROUPS = [
  "European",
  "Māori",
  "Pacific Peoples",
  "Asian",
  "Middle Eastern/Latin American/African",
  "Other"
];

function CreateContactDialogContent({ onSuccess }: { onSuccess: () => void }) {
  const { mutate, isPending } = useCreateContact();
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      userId: "temp",
      name: "",
      businessName: "",
      email: "",
      age: undefined,
      ethnicity: [],
      location: "",
      role: "Mentee",
      tags: [],
    },
  });

  const onSubmit = (data: ContactFormValues) => {
    mutate(data, {
      onSuccess: () => {
        form.reset();
        onSuccess();
      },
    });
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Add New Community Member</DialogTitle>
      </DialogHeader>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto px-1">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" data-testid="input-contact-name" {...form.register("name")} placeholder="e.g. Jane Doe" />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="businessName">Business / Brand Name</Label>
          <Input id="businessName" data-testid="input-contact-business" {...form.register("businessName")} placeholder="e.g. Acme Ltd (leave blank if N/A)" />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" {...form.register("email")} placeholder="jane@example.com" type="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input id="age" {...form.register("age", { valueAsNumber: true })} type="number" placeholder="30" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Ethnicity (Select all that apply)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2 bg-muted/30 p-3 rounded-lg border border-border">
            {ETHNIC_GROUPS.map((group) => (
              <label key={group} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors">
                <input
                  type="checkbox"
                  value={group}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                  onChange={(e) => {
                    const currentValues = form.getValues("ethnicity") || [];
                    if (e.target.checked) {
                      form.setValue("ethnicity", [...currentValues, group]);
                    } else {
                      form.setValue("ethnicity", currentValues.filter((v: string) => v !== group));
                    }
                  }}
                />
                <span>{group}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" {...form.register("location")} placeholder="e.g. Auckland Central" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select 
            id="role" 
            {...form.register("role")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="Mentee">Mentee</option>
            <option value="Business Owner">Business Owner</option>
            <option value="Innovator">Innovator</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma separated)</Label>
          <Input 
            id="tags" 
            placeholder="javascript, startup, leadership" 
            onChange={(e) => {
              const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
              form.setValue('tags', tags);
            }}
          />
        </div>

        <DialogFooter className="mt-6">
          <Button type="submit" isLoading={isPending} className="w-full">Add to Community</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
