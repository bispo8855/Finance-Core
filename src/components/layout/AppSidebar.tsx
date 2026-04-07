import {
  LayoutDashboard, FilePlus, ArrowDownToLine, ArrowUpFromLine,
  TrendingUp, BarChart3, Tags, Building2, Users, Settings, LogOut, History, Calculator
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppBrand } from '@/components/shared/AppBrand';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarSeparator, useSidebar,
} from '@/components/ui/sidebar';

const mainNav = [
  { title: 'Visão Geral', url: '/', icon: LayoutDashboard },
  { title: 'Lançar', url: '/lancar', icon: FilePlus },
  { title: 'Contas a Receber', url: '/receber', icon: ArrowDownToLine },
  { title: 'Contas a Pagar', url: '/pagar', icon: ArrowUpFromLine },
  { title: 'Fluxo de Caixa', url: '/fluxo', icon: TrendingUp },
  { title: 'Análise de Resultado (DRE)', url: '/dre', icon: BarChart3 },
  { title: 'Precificação', url: '/precificacao', icon: Calculator },
];

const registrationNav = [
  { title: 'Lançamentos', url: '/lancamentos', icon: History },
  { title: 'Categorias', url: '/categorias', icon: Tags },
  { title: 'Contas', url: '/contas', icon: Building2 },
  { title: 'Contatos', url: '/contatos', icon: Users },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut } = useAuth();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-6 py-8">
        <AppBrand collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
            Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-all rounded-lg"
                      activeClassName="bg-primary/10 text-primary font-bold shadow-sm"
                    >
                      <item.icon className={cn("w-4 h-4 shrink-0", isActive(item.url) && "text-primary")} />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        
        <div className="py-4" />
        <SidebarSeparator className="opacity-20" />
        <div className="py-4" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest font-semibold">
            Cadastros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {registrationNav.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 transition-all rounded-lg"
                      activeClassName="bg-primary/10 text-primary font-bold shadow-sm"
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Configurações">
                  <NavLink
                    to="/configuracoes"
                    className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                    activeClassName="bg-primary/15 text-primary font-bold"
                  >
                    <Settings className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sair da Conta" onClick={signOut} className="text-secondary-foreground hover:text-destructive">
                  <LogOut className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
