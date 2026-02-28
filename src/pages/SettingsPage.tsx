import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
          <Settings className="w-5 h-5 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      <div className="bg-card rounded-xl border shadow-sm p-8 text-center space-y-3">
        <p className="text-muted-foreground">Esta seção estará disponível em breve.</p>
        <p className="text-sm text-muted-foreground">Aqui você poderá configurar dados da empresa, preferências do sistema e integrações.</p>
      </div>
    </div>
  );
}
