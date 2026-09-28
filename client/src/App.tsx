import { useEffect, useState } from "react";
import { Switch, Route, Router, Link, Redirect, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, PhoneCall, Moon, Sun, Plus, UserPlus, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import ContactDetail from "@/pages/contact-detail";
import Leads from "@/pages/leads";
import Setup from "@/pages/setup";
import { Logo, UIProvider, useUI } from "@/components/common";
import { dueDiff, isSold, useContacts, useTasks } from "@/lib/crm";

function TopBar({ dark, setDark }: { dark: boolean; setDark: (d: boolean) => void }) {
  const [loc] = useLocation();
  const { newCustomer, newCall } = useUI();
  const { data: tasks = [] } = useTasks();
  const { data: contacts = [] } = useContacts();
  const dueCount = tasks.filter((t) => !t.done && t.dueDate && dueDiff(t.dueDate) <= 0).length;
  const leadCount = contacts.filter((c) => c.status === "lead").length;
  const soldCount = contacts.filter((c) => isSold(c.status)).length;
  const path = loc.split("?")[0];
  const leadIds = new Set(contacts.filter((c) => !isSold(c.status)).map((c) => c.id));
  const detailId = path.startsWith("/customers/") ? Number(path.split("/")[2]) : null;
  const tabs = [
    { href: "/", label: "Today", icon: LayoutDashboard, active: path === "/" },
    { href: "/leads", label: "Leads", icon: PhoneCall, count: dueCount || leadCount, alert: dueCount > 0,
      active: path.startsWith("/leads") || (detailId != null && leadIds.has(detailId)) },
    { href: "/customers", label: "Customers", icon: Users, count: soldCount,
      active: path === "/customers" || (detailId != null && !leadIds.has(detailId)) },
  ];
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex h-14 items-center gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0" data-testid="link-home" aria-label="Sales Book home">
          <Logo className="h-7 w-7" />
          <span className="font-bold text-sm tracking-tight hidden md:inline">Sales Book</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-1 ml-4" aria-label="Main">
          {tabs.map((t) => <NavTab key={t.href} {...t} />)}
        </nav>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => newCall()} aria-label="New callback" data-testid="button-new-task">
          <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Callback</span>
        </Button>
        <Button size="sm" onClick={() => newCustomer()} data-testid="button-new-contact">
          <UserPlus className="h-4 w-4 mr-1" />New quote
        </Button>
        <Button size="icon" variant="ghost" asChild aria-label="Setup">
          <Link href="/setup" data-testid="link-setup"><Settings2 className="h-4 w-4" /></Link>
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setDark(!dark)} aria-label="Toggle theme" data-testid="button-theme">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <nav className="sm:hidden grid grid-cols-3 border-t" aria-label="Main">
        {tabs.map((t) => <NavTab key={t.href} {...t} mobile />)}
      </nav>
    </header>
  );
}

function NavTab({ href, label, icon: Icon, active, count, alert, mobile }: any) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined}
      className={cn(
        "relative inline-flex items-center justify-center gap-1.5 text-sm font-medium transition-colors",
        mobile ? "py-2.5" : "h-9 px-3 rounded-md",
        active ? (mobile ? "text-foreground" : "bg-muted text-foreground") : "text-muted-foreground hover:text-foreground",
      )}
      data-testid={`link-nav-${label.toLowerCase()}`}>
      <Icon className="h-4 w-4" />
      {label}
      {count ? <span className={cn("text-xs tabular", alert ? "text-primary font-bold" : "text-muted-foreground")}>{count}</span> : null}
      {mobile && active && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-primary" />}
    </Link>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Contacts} />
      <Route path="/customers/:id" component={ContactDetail} />
      <Route path="/leads" component={Leads} />
      <Route path="/calls">{() => <Redirect to="/leads?s=calls" />}</Route>
      <Route path="/setup" component={Setup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <UIProvider>
            <div className="min-h-dvh bg-background">
              <TopBar dark={dark} setDark={setDark} />
              <main className="min-w-0 px-4 py-6 md:px-8 md:py-8 max-w-[1400px] w-full mx-auto">
                <AppRouter />
              </main>
            </div>
          </UIProvider>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
