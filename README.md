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


## Ajustes desta versão

- Campo de senha com botão **Mostrar/Ocultar** na tela de login.
- Campo de senha com botão **Mostrar/Ocultar** na tela de cadastro de usuários.
- Logo da empresa adicionada na tela de login e no menu lateral usando o link informado.

### Observação sobre a logo
Foi configurado uso direto do link do Imgur com tentativas automáticas em PNG, JPG e JPEG.
Se a imagem não carregar no navegador por alguma limitação externa do Imgur, me envie a logo como arquivo de imagem e eu troco para uma versão local dentro do projeto.


## Atualização: interface original com logs

Esta versão mantém a interface visual anterior, sem a personalização pesada da última versão.

Foi mantido/adicionado:

- Aba **Logs / Auditoria** para admin.
- Registro automático de ações importantes.
- Busca dentro dos logs.
- Exportação dos logs em CSV.

### Ações registradas

- Login
- Produto criado
- Produto atualizado
- Produto excluído
- OP criada
- OP atualizada
- OP excluída
- Usuário criado
- Usuário ativado/desativado
- Backup importado
- Backup exportado
- Relatório exportado
- Logs exportados

### Firestore

Foi adicionada a coleção:

```txt
logsAlteracoes
```

Copie novamente o conteúdo do arquivo `firebase-rules.txt` para o Firestore Rules e publique.


## Atualização: relatório Silk obrigatório

Foi adicionado o relatório **Silk** como processo obrigatório.

A ordem dos relatórios agora é:

```txt
Enfesto
Corte
Silk
Separação
Renda
Alça
Bojo
```

O relatório **Silk** funciona como Enfesto, Corte e Separação: mostra todas as ordens de produção.

Também foi ajustado o log de login para não exibir mais o UID do Firebase no campo "Item". Agora o item aparece como "Sistema".


## Correção: posição final do Silk

O relatório **Silk** foi movido para depois de **Bojo**.

A ordem final dos relatórios ficou:

```txt
Enfesto
Corte
Separação
Renda
Alça
Bojo
Silk
```

O **Silk** continua sendo obrigatório e geral, mostrando todas as ordens de produção.


## Atualização: zerar ordens e importar relatório externo PDF

Esta versão adiciona duas funções administrativas na aba **Importar / Backup**.

### 1. Zerar ordens de produção

O botão **Zerar ordens de produção** apaga todos os documentos da coleção:

```txt
ordensProducao
```

Ele não apaga:

```txt
produtos
usuarios
logsAlteracoes
configuracoes
```

Também registra a ação nos logs.

### 2. Importar relatório externo PDF

A função lê PDFs no padrão do relatório:

```txt
OP-Lote
Referência
COR / TAMANHO
Planejado
```

Ela extrai:

```txt
OP-Lote
Número da OP
Lote
Referência
Produto
Código da cor
Cor
Planejado
```

Antes de importar, o sistema mostra uma prévia.

### Como usar

1. Entre como admin.
2. Vá em **Importar / Backup**.
3. Selecione semana, mês e ano.
4. Clique em **Ler relatório PDF**.
5. Confira a prévia.
6. Clique em **Confirmar importação do PDF**.

Se a referência ainda não existir no cadastro de produtos, o sistema pode cadastrar automaticamente com alça, bojo e renda desmarcados. Depois é só editar a referência e marcar corretamente.


## Atualização: referências pendentes de conferência

Ao importar um PDF, se a referência da OP ainda não existir no cadastro de produtos, o sistema agora marca essa OP como **Pendente**.

Também cria o produto automaticamente com:

```txt
cadastroPendente: true
statusCadastro: pendente
```

E a OP importada fica com:

```txt
referenciaPendente: true
statusReferencia: pendente
```

Assim os responsáveis sabem que precisam abrir o cadastro da referência e conferir se possui:

```txt
Alça
Bojo
Renda / Sutiã
```

Quando o admin salva/atualiza o produto manualmente, o sistema atualiza automaticamente todas as ordens daquela referência, copia as marcações corretas de alça, bojo e renda e remove o status de pendência das OPs.


## Atualização: painel separado de referências pendentes

A aba **Produtos / Referências** agora possui um bloco separado no topo:

```txt
Referências pendentes de conferência
```

Esse bloco mostra somente as referências criadas automaticamente pela importação do PDF e que ainda precisam ser conferidas.

Para cada referência pendente, aparece:

```txt
Referência
Produto
Quantidade de OPs pendentes
Observação da pendência
Botão Conferir
Botão Ver OPs
```

### Como resolver uma pendência

1. Vá em **Produtos / Referências**.
2. No bloco **Referências pendentes de conferência**, clique em **Conferir**.
3. Marque se a referência possui **alça**, **bojo** e **renda/sutiã**.
4. Salve o produto.
5. O sistema atualiza automaticamente todas as OPs daquela referência e remove o status de pendente.
