import { i18n } from "./language";

export const language: i18n = 
{
	cancel: "Cancelar",
	browse: "Procurar",
	pathInputPlaceholder: "Digite ou procure um caminho...",
	pathValidations:
	{
		noEmpty: "O caminho não pode estar vazio",
		mustExist: "O caminho não existe",
		noTilde: "Diretório inicial com til (~) não é permitido",
		noAbsolute: "O caminho não pode ser absoluto",
		noRelative: "O caminho não pode ser relativo",
		noFiles: "O caminho não pode ser um arquivo",
		noFolders: "O caminho não pode ser um diretório",
		mustHaveExtension: "O caminho deve ter a extensão: {0}",
	},
	updateAvailable: "Atualização disponível",
	exportAsHTML: "Exportar como HTML",
	exportModal: 
	{
		title: "Exportar para HTML",
		exportAsTitle: "Exportar {0} como HTML",
		moreOptions: "Mais opções disponíveis na página de configurações do plugin.",
		openAfterExport: "Abrir após exportar",
		exportButton: "Exportar",
		filePicker: 
		{
			title: "Selecionar todos os arquivos no cofre exportado",
			selectAll: "Selecionar tudo",
			save: "Salvar",
		},
		currentSite: 
		{
			noSite: "Este caminho não contém um site exportado atualmente.",
			oldSite: "Este caminho contém uma exportação criada com uma versão diferente do plugin.",
			pathContainsSite: "Site",
			fileCount: "Quantidade de arquivos",
			lastExported: "Última exportação",
		},
		exportMode: {
			title: "Modo de Exportação",
			online: "Use este modo se seus arquivos forem acessados online (via servidor http).",
			local: "Este modo exporta um único arquivo HTML (grande) contendo toda a exportação. Use apenas para compartilhamento offline.",
			rawDocuments: "Exportar documentos HTML simples com estilo e scripts básicos, sem recursos adicionais.",
		},
		purgeExport:
		{
			description: "Limpe o cache do site para reexportar todos os arquivos ou exclua o site com todos os seus arquivos.",
			clearCache: "Limpar Cache",
			confirmation: "Tem certeza?",
			clearWarning: "Isso excluirá os metadados do site (mas não todo o HTML exportado).\n\nForçará a reexportação de todos os arquivos.\n\nAlém disso se você alterar os arquivos selecionados antes da próxima exportação, alguns arquivos podem permanecer inutilizados no seu sistema.\n\nEsta ação não pode ser desfeita.",
		},
	},
	settings: 
	{
		title: "Configurações de Exportação HTML",
		support: "Apoie o desenvolvimento contínuo deste plugin.",
		debug: "Copiar informações de debug para a área de transferência",
		unavailableSetting: "⚠️ Este recurso não está disponível no modo {0}.",
		pageFeatures: {
			title: "Recursos da Página",
			description: "Controle diversos recursos da página exportada."
		},
		baseFeatures:
		{
			info_selector: "Seletor CSS de um elemento. O recurso será posicionado em relação a esse elemento.",
			info_type: "Este recurso será colocado antes, depois ou dentro (no início ou final).",
			info_displayTitle: "Título descritivo a ser exibido acima do recurso",
			info_featurePlacement: "Onde posicionar esse recurso na página. (Relativo ao seletor)",
		},
		document: {
			title: "Documento",
			description: "Controle configurações do próprio documento",
			info_allowFoldingLists: "Permitir que listas sejam recolhidas",
			info_allowFoldingHeadings: "Permitir que cabeçalhos sejam recolhidos",
			info_documentWidth: "A largura do documento"
		},
		sidebars: {
			title: "Barras Laterais",
			description: "Contém recursos como navegação de arquivos, sumário, alternância de tema, visualização em gráfico etc.",
			info_allowResizing: "Permitir redimensionamento das barras laterais",
			info_allowCollapsing: "Permitir recolher as barras laterais",
			info_rightDefaultWidth: "Largura padrão da barra lateral direita",
			info_leftDefaultWidth: "Largura padrão da barra lateral esquerda"
		},
		fileNavigation: {
			title: "Navegação de Arquivos",
			description: "Exibe uma árvore de arquivos para explorar o cofre exportado.",
			info_showCustomIcons: "Exibir ícones personalizados para arquivos e pastas",
			info_showDefaultFolderIcons: "Mostrar ícone padrão para cada pasta na árvore",
			info_showDefaultFileIcons: "Mostrar ícone padrão para cada arquivo na árvore",
			info_defaultFolderIcon: "Ícone usado para pastas. Prefixe com 'lucide//' para usar um ícone do Lucide",
			info_defaultFileIcon: "Ícone usado para arquivos. Prefixe com 'lucide//' para usar um ícone do Lucide",
			info_defaultMediaIcon: "Ícone usado para arquivos de mídia. Prefixe com 'lucide//' para usar um ícone do Lucide",
			info_exposeStartingPath: "Mostrar o arquivo atual na árvore ao carregar a página"
		},
		outline: {
			title: "Sumário", 
			description: "Exibe uma lista de cabeçalhos do documento aberto.",
			info_startCollapsed: "O sumário deve começar recolhido?",
			info_minCollapseDepth: "Permitir recolhimento apenas se o item tiver ao menos esse número de níveis na árvore."
		},
		graphView: {
			title: "Visualização em Gráfico",
			description: "Mostra uma representação interativa do seu cofre. (NOTA: disponível apenas em exportações hospedadas num servidor web)",
			info_showOrphanNodes: "Exibir nós sem conexão com outros",
			info_showAttachments: "Mostrar anexos como imagens e PDFs como nós no gráfico.",
			info_allowGlobalGraph: "Permitir ao utilizador a visualização do gráfico global para todos os nós",
			info_allowExpand: "Permitir expandir a visualização para tela inteira",
			info_attractionForce: "Com qual força os nós são atraídos uns pelos outros? Isso fará com que o gráfico seja mais compacto.",
			info_linkLength: "Quão longos os links entres os nós devem ser? Quanto mais curtos os links, mais conectados os nós parecerão.",
			info_repulsionForce: "Com qual força os nós são repelidos uns dos outros? Isso fará com que partes desconectadas do gráfico estejam mais espaçadas.",
			info_centralForce: "Com qual intensidade os nós são atraídos para o centro do gráfico? Isso fará com que o gráfico seja mais denso e circular.",
			info_edgePruning: "Arestas com copmrimeto menor que esse limite não serão renderizadas, no entanto, ainda contribuirão para a simulação. Isso pode ser útil para que gráficos enrolados sejam apresentados de forma mais organizada. Passando o mouse sobre um nó mostrará todas as arestas conectadas a ele.",
			info_minNodeRadius: "Quão pequenos os menores nós devem ser? Quando menor um nó, menos atrairá outros nós.",
			info_maxNodeRadius: "Quão grandes os maiores nós devem ser? Nós são escalados proporcionalmente ao número de conexões que têm. Quanto maior um nó, mais atrairá outros nós. Isso pode ser útil para agrupar e destacar nós importantes."
		},		search: {
			title: "Barra de Pesquisa",
			description: "Permite pesquisar no cofre, listando arquivos e cabeçalhos correspondentes. (NOTA: disponível apenas em exportações hospedadas na web)",
			placeholder: "Pesquisar..."
		},
		linkPreview: {
			title: "Pré-visualizações de Links",
			description: "Mostrar pré-visualizações ao passar o mouse sobre links internos para outros documentos."
		},
		themeToggle: {
			title: "Alternar Tema",
			description: "Permite alternar entre tema claro e escuro dinamicamente."
		},
		customHead: {
			title: "HTML / JS Personalizado",
			description: "Insere um arquivo .html que pode conter JS ou CSS personalizados",
			info_sourcePath: "Caminho local do arquivo .html que será incluído.",
			validationError: "Deve ser o caminho de um arquivo .html"
		},
		backlinks: {
			title: "Links de Retorno",
			description: "Mostra os documentos que fazem referência ao documento atual."
		},
		tags: {
			title: "Tags",
			description: "Exibe as tags do documento aberto.",
			info_showInlineTags: "Mostrar tags definidas dentro do conteúdo no topo da página.",
			info_showFrontmatterTags: "Mostrar tags definidas no frontmatter no topo da página."
		},
		aliases: {
			title: "Apelidos",
			description: "Exibe os apelidos do documento atual."
		},
		properties: {
			title: "Propriedades",
			description: "Exibe todas as propriedades do documento em uma tabela.",
			info_hideProperties: "Lista de propriedades a ocultar na visualização"
		},
		rss: {
			title: "RSS",
			description: "Gera um feed RSS para o site exportado",
			info_siteUrl: "URL onde o site será hospedado",
			info_siteUrlPlaceholder: "https://exemplo.com/meusite",
			info_authorName: "Nome do autor do site"
		},
		styleOptionsSection: {
			title: "Opções de Estilo",
			description: "Configure quais estilos serão incluídos na exportação"
		},
		makeOfflineCompatible: {
			title: "Tornar Compatível com Modo Offline",
			description: "Baixar recursos / imagens / scripts online para que a página funcione offline. Ou evitar dependência de CDNs."
		},
		includePluginCSS: {
			title: "Incluir CSS de Plugins",
			description: "Inclui CSS de plugins na exportação do HTML. Se recursos do plugin não renderizarem corretamente, adicione o plugin nessa lista. Evite adicionar plugins sem necessidade, pois isso aumenta o tempo de carregamento da sua página, quanto mais CSS for incluído."
		},
		includeStyleCssIds: {
			title: "Incluir Estilos com IDs",
			description: "Inclui CSS de tags de estilo com os IDs especificados"
		},
		generalSettingsSection:{
			title: "Configurações Gerais",
			description: "Controle configurações simples como favicon e metadados do site",
		},
		favicon: {
			title: "Imagem do Favicon",
			description: "Caminho local da imagem favicon do site",
		},
		siteName: {
			title: "Nome do Site",
			description: "Nome do cofre / site exportado",
		},
		iconEmojiStyle: {
			title: "Estilo de Emoji para Ícones",
			description: "Estilo de emoji usado para ícones personalizados",
		},
		themeName: {
			title: "Tema",
			description: "Tema instalado a ser usado na exportação",
		},
		exportSettingsSection: {
			title: "Configurações de Exportação",
			description: "Configurações técnicas como controle de geração de links",
		},
		relativeHeaderLinks: {
			title: "Usar Links Relativos para Cabeçalhos",
			description: "Utiliza links relativos em vez de absolutos para cabeçalhos",
		},
		slugifyPaths: {
			title: "Slugificar Caminhos",
			description: "Transformar caminhos e nomes de arquivos para formato web (minúsculo, sem espaços)",
		},
		addPageIcon: {
			title: "Adicionar Ícone à Página",
			description: "Adiciona o ícone do arquivo ao cabeçalho da página",
		},
		obsidianSettingsSection: {
			title: "Configurações do Obsidian",
			description: "Controla o funcionamento do plugin dentro do Obsidian",
		},
		logLevel: {
			title: "Nível de Log",
			description: "Define o nível de detalhamento nos logs do console",
		},
		titleProperty: {
			title: "Propriedade de Título",
			description: "Propriedade a ser usada como título do documento",
		},
	}
}
