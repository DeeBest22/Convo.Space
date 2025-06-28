 const triggerButton = document.getElementById('vortex-primary-activator-3k7s');
        const toolsPanel = document.getElementById('dimension-tools-overlay-4h9w');
        let isPanelVisible = false;

        triggerButton.addEventListener('click', function(e) {
            e.stopPropagation();
            isPanelVisible = !isPanelVisible;
            
            if (isPanelVisible) {
                toolsPanel.classList.add('stellar-active-state-6v8n');
            } else {
                toolsPanel.classList.remove('stellar-active-state-6v8n');
            }
        });

        document.addEventListener('click', function(e) {
            if (!toolsPanel.contains(e.target) && !triggerButton.contains(e.target)) {
                toolsPanel.classList.remove('stellar-active-state-6v8n');
                isPanelVisible = false;
            }
        });

        function handleToolClick(tool) {
            console.log(`${tool} tool activated`);
            // Add your tool-specific functionality here
        }