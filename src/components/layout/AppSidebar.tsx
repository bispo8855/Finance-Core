import {
  LayoutDashboard, PlusCircle, ArrowDownToLine, ArrowUpFromLine,
  Activity, BarChart3, Tags, Building2, Users, Settings, LogOut, Clock3, Tag, Zap, FileSpreadsheet
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

const movementNav = [
  { title: 'Lançar', url: '/lancar', icon: PlusCircle },
  { title: 'Importar', url: '/importar', icon: FileSpreadsheet },
  { title: 'Contas a Receber', url: '/receber', icon: ArrowDownToLine },
  { title: 'Contas a Pagar', url: '/pagar', icon: ArrowUpFromLine },
  { title: 'Fluxo de Caixa', url: '/fluxo', icon: Activity },
  { title: 'Extrato', url: '/extrato', icon: Zap },
  { title: 'Histórico', url: '/lancamentos', icon: Clock3 },
];

const analysisNav = [
  { title: 'Resultado (DRE)', url: '/dre', icon: BarChart3 },
  { title: 'Precificação', url: '/precificacao', icon: Tag },
];

const registrationNav = [
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
      <SidebarHeader className="px-4 py-8">
        <AppBrand collapsed={collapsed} />
      </SidebarHeader>

      <SidebarContent>
        {/* Visão Geral - Standalone */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Visão Geral">
                  <NavLink
                    to="/"
                    end
                    className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-all rounded-lg"
                    activeClassName="bg-primary/10 text-primary font-bold shadow-sm"
                  >
                    <LayoutDashboard className={cn("w-4 h-4 shrink-0", isActive('/') && "text-primary")} />
                    {!collapsed && <span>Visão Geral</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* MOVIMENTAÇÕES */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-[0.1em] font-bold px-4 mb-2">
            Movimentações
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {movementNav.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-all rounded-lg"
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

        {/* ANÁLISES */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-[0.1em] font-bold px-4 mb-2">
            Análises
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {analysisNav.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-all rounded-lg"
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

        {/* CADASTROS */}
        <SidebarGroup className="mb-4">
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-[0.1em] font-bold px-4 mb-2">
            Cadastros
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {registrationNav.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-all rounded-lg"
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

        <SidebarSeparator className="mx-4 opacity-10" />

        {/* Standalone Settings & Logout */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Configurações">
                  <NavLink
                    to="/configuracoes"
                    className="text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/10 transition-all rounded-lg"
                    activeClassName="bg-primary/15 text-primary font-bold"
                  >
                    <Settings className={cn("w-4 h-4 shrink-0", isActive('/configuracoes') && "text-primary")} />
                    {!collapsed && <span>Configurações</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Sair da Conta" onClick={signOut} className="text-sidebar-foreground/50 hover:text-destructive transition-colors">
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
