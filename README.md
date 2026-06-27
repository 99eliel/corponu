# Sistema OP Confecção com Firebase e Login

Esta versão usa:

- Firebase Authentication
- Cloud Firestore
- Login com e-mail e senha
- Perfil de usuário na coleção `usuarios`
- Perfil admin e usuário comum
- Produtos/referências no Firestore
- Ordens de produção no Firestore
- Relatórios puxando do Firestore

## Antes de abrir o sistema

No Firebase Console:

### 1. Authentication

Ative:

- Authentication > Sign-in method > Email/Password

Depois crie seu primeiro usuário admin em:

- Authentication > Users > Add user

Copie o UID desse usuário.

### 2. Firestore

Crie o Firestore Database em modo Production.

Depois crie manualmente a coleção:

`usuarios`

E dentro dela crie um documento com o ID igual ao UID do usuário admin.

Exemplo:

Documento:

`usuarios/UID_DO_ADMIN`

Campos:

```txt
nome: Eliel
email: seuemail@empresa.com
tipo: admin
ativo: true
criadoEm: 2026-06-27
```

### 3. Regras

Copie o conteúdo do arquivo `firebase-rules.txt` e cole em:

Firestore Database > Rules

Depois clique em Publish.

## Como rodar localmente

Como o sistema usa `script type="module"` e Firebase via CDN, não é recomendado abrir direto pelo `file://`.

Opções:

### Opção 1: VS Code Live Server

1. Abra a pasta no VS Code.
2. Instale a extensão Live Server.
3. Clique com botão direito no `index.html`.
4. Clique em "Open with Live Server".

### Opção 2: Python

Abra o terminal dentro da pasta e rode:

```bash
python -m http.server 5500
```

Depois acesse:

```txt
http://localhost:5500
```

## Importar dados da planilha

Dentro do ZIP existe o arquivo:

`backup-op-confeccao-planilha.json`

Entre como admin no sistema, vá em:

Importar / Backup > Importar backup JSON para Firestore

Selecione esse arquivo.

## Permissões

### Admin

- Cadastra produtos/referências
- Edita produtos/referências
- Exclui produtos/referências
- Cria ordens de produção
- Edita ordens de produção
- Exclui ordens de produção
- Cria usuários
- Ativa/desativa usuários
- Importa backup para o Firestore

### Usuário comum

- Visualiza produtos
- Cria ordens de produção
- Edita ordens de produção
- Visualiza relatórios
- Não cria produtos
- Não cria usuários
- Não exclui ordens
