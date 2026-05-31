import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Settings, Building2, User, Loader2, Save } from 'lucide-react';

export default function SettingsPage() {
  const { profile, activeWorkspace, updateProfile, updateActiveWorkspace } = useAuth();
  const { toast } = useToast();

  // Workspace Form State
  const [workspaceName, setWorkspaceName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [workspaceInitials, setWorkspaceInitials] = useState('');
  const [isWorkspaceSaving, setIsWorkspaceSaving] = useState(false);

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileInitials, setProfileInitials] = useState('');
  const [isProfileSaving, setIsProfileSaving] = useState(false);

  // Populate data when loaded
  useEffect(() => {
    if (activeWorkspace) {
      setWorkspaceName(activeWorkspace.name || '');
      setLegalName(activeWorkspace.legalName || '');
      setDocumentNumber(activeWorkspace.documentNumber || '');
      setWorkspaceInitials(activeWorkspace.avatarInitials || '');
    }
  }, [activeWorkspace]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName || '');
      setDisplayName(profile.displayName || '');
      setProfileInitials(profile.avatarInitials || '');
    }
  }, [profile]);

  const handleSaveWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) {
      toast({
        variant: "destructive",
        title: "Nome do negócio obrigatório",
        description: "O nome de exibição do negócio não pode estar vazio.",
      });
      return;
    }

    setIsWorkspaceSaving(true);
    try {
      await updateActiveWorkspace({
        name: workspaceName,
        legalName: legalName || null,
        documentNumber: documentNumber || null,
        avatarInitials: workspaceInitials || null,
      });

      toast({
        title: "Dados do negócio atualizados!",
        description: "As alterações do seu workspace financeiro foram salvas.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: err?.message || "Não foi possível atualizar os dados do workspace.",
      });
    } finally {
      setIsWorkspaceSaving(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProfileSaving(true);
    try {
      await updateProfile({
        fullName: fullName || null,
        displayName: displayName || null,
        avatarInitials: profileInitials || null,
      });

      toast({
        title: "Perfil pessoal atualizado!",
        description: "Seus dados de perfil foram salvos com sucesso.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: err?.message || "Não foi possível atualizar os dados do perfil.",
      });
    } finally {
      setIsProfileSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center border shadow-sm">
          <Settings className="w-5 h-5 text-accent-foreground" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workspace Card Form */}
        <Card className="border shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <form onSubmit={handleSaveWorkspace} className="flex flex-col h-full justify-between">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <Building2 className="w-5 h-5" />
                <CardTitle className="text-lg font-bold">Perfil do Negócio / Workspace</CardTitle>
              </div>
              <CardDescription>
                Configure os dados da sua empresa ou ambiente de finanças.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Nome do Negócio / Exibição *</Label>
                <Input
                  id="workspace-name"
                  type="text"
                  placeholder="Ex: Rosa Charmosa"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal-name">Razão Social / Nome Completo</Label>
                <Input
                  id="legal-name"
                  type="text"
                  placeholder="Ex: Rosa Charmosa Vestuário ME"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document-number">CNPJ ou CPF (opcional)</Label>
                <Input
                  id="document-number"
                  type="text"
                  placeholder="Ex: 00.000.000/0001-00"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-initials">Iniciais do Avatar (opcional)</Label>
                <Input
                  id="workspace-initials"
                  type="text"
                  maxLength={3}
                  placeholder="Ex: RC"
                  value={workspaceInitials}
                  onChange={(e) => setWorkspaceInitials(e.target.value.toUpperCase())}
                />
                <p className="text-[11px] text-muted-foreground">
                  Se deixado em branco, geramos as iniciais automaticamente a partir do nome do negócio.
                </p>
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t bg-muted/20 flex justify-end">
              <Button type="submit" disabled={isWorkspaceSaving} className="gap-2">
                {isWorkspaceSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Negócio
              </Button>
            </CardFooter>
          </form>
        </Card>

        {/* Profile Card Form */}
        <Card className="border shadow-sm flex flex-col justify-between transition-all duration-300 hover:shadow-md">
          <form onSubmit={handleSaveProfile} className="flex flex-col h-full justify-between">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary">
                <User className="w-5 h-5" />
                <CardTitle className="text-lg font-bold">Meu Perfil</CardTitle>
              </div>
              <CardDescription>
                Gerencie suas informações de usuário do Aurys.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-grow">
              <div className="space-y-2">
                <Label htmlFor="full-name">Nome Completo</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="Ex: Marcelo Bispo Leandro"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="display-name">Como quer ser chamado (Apelido)</Label>
                <Input
                  id="display-name"
                  type="text"
                  placeholder="Ex: Marcelo"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-initials">Iniciais Pessoais (opcional)</Label>
                <Input
                  id="profile-initials"
                  type="text"
                  maxLength={3}
                  placeholder="Ex: MBL"
                  value={profileInitials}
                  onChange={(e) => setProfileInitials(e.target.value.toUpperCase())}
                />
              </div>
            </CardContent>
            <CardFooter className="pt-4 border-t bg-muted/20 flex justify-end">
              <Button type="submit" disabled={isProfileSaving} className="gap-2">
                {isProfileSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar Perfil
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
