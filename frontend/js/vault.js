// Dexie database instantiation
const vaultDb = new Dexie("BiblioDriftVaultDB");
vaultDb.version(4).stores({
    securedFiles: '++id, name, type, size, genre, privacy, uploadedAt'
});

document.addEventListener('DOMContentLoaded', async () => {
    const fileInput = document.getElementById('vaultFileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const vaultGrid = document.getElementById('vault-grid');
    const dropZone = document.getElementById('dropZone');
    const fileFeedback = document.getElementById('fileSelectedFeedback');
    const searchInput = document.getElementById('searchInput');
    const libraryGridTarget = document.getElementById('library-books-grid');
    const metadataFormSection = document.getElementById('metadataFormSection');
    const fileGenre = document.getElementById('fileGenre');
    const fileDescription = document.getElementById('fileDescription');
    const cardPrivate = document.getElementById("pCardPrivate");
    const cardPublic = document.getElementById("pCardPublic");
    const radPrivate = document.getElementById("radPrivate");
    const radPublic = document.getElementById("radPublic");

    let activeObjectUrlsPool = [];

    function clearActiveObjectUrls() {
        activeObjectUrlsPool.forEach(url => URL.revokeObjectURL(url));
        activeObjectUrlsPool = [];
    }

    if (vaultGrid) {
        displayVaultFiles();
    }
    
    if (libraryGridTarget) {
        integrateVaultIntoLibrary(libraryGridTarget);
    }
    if (cardPrivate && radPrivate) {
        cardPrivate.addEventListener("click", () => { radPrivate.checked = true; });
    }
    if (cardPublic && radPublic) {
        cardPublic.addEventListener("click", () => { radPublic.checked = true; });
    }

    function updateFileInputFeedback() {
        if (fileInput && fileInput.files.length > 0) {
            fileFeedback.innerHTML = `<i class="fa-solid fa-file-signature"></i> Staged File: <span style="text-decoration: underline;">${fileInput.files[0].name}</span>`;
            if (metadataFormSection) metadataFormSection.style.display = 'block';
        } else {
            if (fileFeedback) fileFeedback.innerText = '';
            if (metadataFormSection) metadataFormSection.style.display = 'none';
        }
    }

    if (fileInput) {
        fileInput.addEventListener('change', updateFileInputFeedback);
    }
    if (dropZone && fileInput) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.style.background = "rgba(255,255,255,0.04)";
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.style.background = "rgba(255,255,255,0.01)";
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                fileInput.files = files;
                updateFileInputFeedback();
            }
        });
    }

    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];

            if (!file) {
                alert("Operational Fault: Please select or drop a valid record target entry.");
                return;
            }

            const MAX_IDB_LIMIT = 25 * 1024 * 1024; // 25 MB Browser Safety Ceiling
            if (file.size > MAX_IDB_LIMIT) {
                alert("File Warning: High volume assets are optimized down underneath 25MB thresholds.");
                return;
            }

            const privacyRadio = document.querySelector('input[name="filePrivacy"]:checked');
            const selectedPrivacy = privacyRadio ? privacyRadio.value : 'private';
            const inputGenreValue = fileGenre ? fileGenre.value : 'General';
            const inputDescValue = fileDescription ? fileDescription.value.trim() : 'No annotation summary log notes provided.';

            try {
                uploadBtn.disabled = true;
                uploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Encrypting & Securing...`;

                const targetDocumentModel = {
                    name: file.name,
                    type: file.type || 'application/octet-stream', 
                    size: file.size,
                    genre: inputGenreValue,
                    description: inputDescValue || 'No annotation summary log notes provided.',
                    privacy: selectedPrivacy,
                    binaryData: file, 
                    uploadedAt: new Date().toLocaleString()
                };

                if (!(targetDocumentModel.binaryData instanceof Blob)) {
                    alert("System Error: The file stream could not be processed into a valid binary object.");
                    return;
                }
                await vaultDb.securedFiles.add(targetDocumentModel);
                if (selectedPrivacy === 'public') {
                    await syncDocumentToFlaskCloud(targetDocumentModel);
                } else {
                    alert(`Success: "${file.name}" successfully committed inside your isolated local browser workspace.`);
                }
                fileInput.value = '';
                if (fileFeedback) fileFeedback.innerText = '';
                if (fileDescription) fileDescription.value = '';
                if (fileGenre) fileGenre.value = 'General';
                if (metadataFormSection) metadataFormSection.style.display = 'none';
                if (vaultGrid) displayVaultFiles(searchInput ? searchInput.value : '');
                if (libraryGridTarget) integrateVaultIntoLibrary(libraryGridTarget);

            } catch (error) {
                console.error("Local operational save failure logged:", error);
                alert("Process Interrupted: Could not write record data to internal memory storage.");
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = `<i class="fa-solid fa-vault"></i> Secure File to Vault`;
            }
        });
    }

    async function syncDocumentToFlaskCloud(docModel) {
        const mockGoogleBooksId = "vault_" + Math.random().toString(36).substring(2, 11);
        
        const syncPayload = {
            user_id: localStorage.getItem('bibliodrift_user_id') || "1002", 
            google_books_id: mockGoogleBooksId,
            title: docModel.name,
            authors: ["Local Vault Repository Submitter"],
            thumbnail: "../assets/images/biblioDrift_favicon.png",
            shelf_type: "READING", 
            genre: docModel.genre,
            description: docModel.description,
            privacy: docModel.privacy
        };

        const activeJwtToken = localStorage.getItem('bibliodrift_access_token');

        try {
            const response = await fetch((window.VAULT_API_BASE || window.MOOD_API_BASE || 'http://127.0.0.1:5001/api/v1') + '/library', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': activeJwtToken ? `Bearer ${activeJwtToken}` : ''
                },
                body: JSON.stringify(syncPayload)
            });

            const responseData = await response.json();
            
            if (response.ok) {
                alert(`Cloud Sync Connected: "${docModel.name}" has been mapped to global discovery feeds successfully.`);
            } else {
                console.warn("Cloud synchronization returned rejected metrics packet:", responseData);
                alert(`Saved Locally: Locked to local browser workspace, but cloud sync failed: ${responseData.error || 'Server rejected request'}`);
            }
        } catch (networkError) {
            console.error("Network interface connection failure connecting to Flask server registry:", networkError);
            alert("Local Save Completed: Network routing offline. Item preserved safely inside browser vault workspace.");
        }
    }

    async function displayVaultFiles(filterQuery = '') {
        if (!vaultGrid) return;
        
        clearActiveObjectUrls();
        vaultGrid.innerHTML = '';

        try {
            let dataCollection = await vaultDb.securedFiles.toArray();
            dataCollection.reverse(); 

            if (filterQuery.trim() !== '') {
                const searchStr = filterQuery.toLowerCase();
                dataCollection = dataCollection.filter(item => 
                    item.name.toLowerCase().includes(searchStr) || 
                    item.genre.toLowerCase().includes(searchStr) ||
                    (item.description && item.description.toLowerCase().includes(searchStr))
                );
            }

            if (dataCollection.length === 0) {
                vaultGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; color: var(--text-main); padding: 50px 20px; opacity: 0.55;">
                        <i class="fa-solid fa-cubes-stacked" style="font-size: 2.8rem; margin-bottom: 12px; display: block;"></i>
                        <p>${filterQuery ? 'No records match your current directory text filter criteria.' : 'Your reading vault repository workspace is empty.'}</p>
                    </div>
                `;
                return;
            }

            let vaultJsRenderIndex = 0;
            const vaultJsChunkSize = window.CONFIG?.CHUNK_SIZE || 20;

            if (vaultGrid._vaultObserver) {
                vaultGrid._vaultObserver.disconnect();
            }

            const sentinel = document.createElement('div');
            sentinel.style.width = '100%';
            sentinel.style.height = '20px';
            sentinel.style.gridColumn = '1 / -1';

            vaultGrid._vaultObserver = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    renderChunk();
                }
            });

            function renderChunk() {
                const chunk = dataCollection.slice(vaultJsRenderIndex, vaultJsRenderIndex + vaultJsChunkSize);
                if (chunk.length === 0) return;

                if (sentinel.parentNode) {
                    vaultGrid.removeChild(sentinel);
                }

                chunk.forEach(file => {
                    const documentCard = document.createElement('div');
                    documentCard.className = 'genre-card';
                    documentCard.style.flexDirection = 'column';
                    documentCard.style.padding = '25px 20px';
                    documentCard.style.gap = '10px';
                    documentCard.style.position = 'relative';

                    let iconTypeMap = 'fa-file-shield';
                    if (file.type.startsWith('image/')) iconTypeMap = 'fa-file-image';
                    else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) iconTypeMap = 'fa-file-pdf';
                    else if (file.type.startsWith('text/')) iconTypeMap = 'fa-file-lines';

                    let localizedObjectURL = "#";
                    if (file.binaryData instanceof Blob) {
                        localizedObjectURL = URL.createObjectURL(file.binaryData);
                        activeObjectUrlsPool.push(localizedObjectURL);
                    }

                    const computedSizeInMB = (file.size / (1024 * 1024)).toFixed(2);
                    const safeName = DOMPurify.sanitize(file.name);
                    const safeGenre = DOMPurify.sanitize(file.genre);
                    const safeDescription = DOMPurify.sanitize(file.description || 'No annotation summary log notes provided.');
                    const safeMetadataString = DOMPurify.sanitize(`${computedSizeInMB} MB • ${file.uploadedAt}`);
                    
                    const badgeClassMap = file.privacy === 'private' ? 'status-is-private' : 'status-is-public';
                    const iconClassMap = file.privacy === 'private' ? 'fa-user-lock' : 'fa-share-nodes';

                    documentCard.innerHTML = `
                        <button class="purge-item-trigger" data-row-id="${file.id}" title="Delete document registry entry" 
                                style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 1.1rem; opacity: 0.6; transition: opacity 0.2s;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                        
                        <i class="fa-solid ${iconTypeMap}" style="font-size: 2.6rem; color: var(--text-main); margin-bottom: 3px;"></i>
                        
                        <span style="font-weight: 600; text-align: center; word-break: break-word; font-family: 'Georgia', serif; font-size: 1.05rem;">${safeName}</span>
                        
                        <span style="font-size: 0.78rem; font-weight: 500; font-style: italic; opacity: 0.85; background: rgba(255,255,255,0.04); padding: 3px 10px; border-radius: 12px; display: inline-block;">
                          Classification: ${safeGenre}
                        </span>

                        <p style="font-size: 0.85rem; opacity: 0.7; text-align: center; margin: 4px 0; max-height: 50px; overflow-y: auto; width: 100%; word-break: break-word; line-height: 1.35; padding: 0 4px;">
                          ${safeDescription}
                        </p>

                        <span style="font-size: 0.72rem; opacity: 0.45; text-align: center; letter-spacing: 0.3px;">${safeMetadataString}</span>
                        
                        <div>
                          <span class="visibility-status-badge ${badgeClassMap}"><i class="fa-solid ${iconClassMap}"></i> Settings: ${file.privacy}</span>
                        </div>

                        <div style="display: flex; gap: 10px; width: 100%; margin-top: 10px;">
                            <a href="${localizedObjectURL}" target="_blank" class="btn-preview" 
                               style="flex: 1; text-align: center; font-size: 12px; padding: 8px 0; text-decoration: none; border-radius: 6px; display: inline-block; background: var(--border-focus, #9b59b6); color: white; font-weight: 500;">
                               <i class="fa-solid fa-up-right-from-square"></i> Open
                            </a>
                            <a href="${localizedObjectURL}" download="${safeName}" class="btn-secondary" 
                               style="flex: 1; text-align: center; font-size: 12px; padding: 8px 0; text-decoration: none; border-radius: 6px; border: 1px solid currentColor; display: inline-block;">
                               <i class="fa-solid fa-download"></i> Extract
                            </a>
                        </div>
                    `;

                    const dropBtn = documentCard.querySelector('.purge-item-trigger');
                    if (dropBtn) {
                        dropBtn.addEventListener('mouseover', () => dropBtn.style.opacity = '1');
                        dropBtn.addEventListener('mouseout', () => dropBtn.style.opacity = '0.6');
                        dropBtn.addEventListener('click', async (event) => {
                            if (confirm("Confirm Deletion Action: This file tracking record will be cleared from your local storage system cache completely. Proceed?")) {
                                try {
                                    await vaultDb.securedFiles.delete(file.id);
                                    displayVaultFiles(document.getElementById('vault-search-query') ? document.getElementById('vault-search-query').value : '');
                                } catch (err) {
                                    console.error("Dexie processing dropped during record destruction processing phase:", err);
                                }
                            }
                        });
                    }

                    vaultGrid.appendChild(documentCard);
                });

                vaultJsRenderIndex += vaultJsChunkSize;
                if (vaultJsRenderIndex < dataCollection.length) {
                    vaultGrid.appendChild(sentinel);
                    vaultGrid._vaultObserver.observe(sentinel);
                } else if (vaultGrid._vaultObserver) {
                    vaultGrid._vaultObserver.disconnect();
                }
            }

            renderChunk();

            initializeDestructionTriggers();

        } catch (error) {
            console.error("View painting interface process loop dropped errors:", error);
            vaultGrid.innerHTML = `<p style="color: #e74c3c; text-align: center; grid-column: 1/-1;">Critical Error: Secure local document catalog retrieval failures.</p>`;
        }
    }
    async function integrateVaultIntoLibrary(targetContainer) {
        try {
            const vaultItems = await vaultDb.securedFiles.toArray();
            if (vaultItems.length === 0) return;

            const oldDivider = document.getElementById('vault-library-divider');
            if (oldDivider) oldDivider.remove();
            document.querySelectorAll('.vault-injected-card').forEach(el => el.remove());
            const divider = document.createElement('div');
            divider.id = 'vault-library-divider';
            divider.style.gridColumn = '1 / -1';
            divider.style.margin = '40px 0 20px 0';
            divider.innerHTML = `
                <h3 style="font-family: 'Georgia', serif; font-size: 1.6rem; display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                    <i class="fa-solid fa-shield-halved" style="color: var(--border-focus, #9b59b6);"></i> Local Vault Documents
                </h3>
                <p style="font-size: 0.85rem; opacity: 0.6; margin: 0;">Secured local browser file injections available on this workstation container layer.</p>
            `;
            targetContainer.appendChild(divider);
            vaultItems.reverse().forEach(item => {
                const card = document.createElement('div');
                card.className = 'book-card genre-card vault-injected-card';
                card.style.display = 'flex';
                card.style.flexDirection = 'column';
                card.style.position = 'relative';

                let fileUrl = '#';
                if (item.binaryData instanceof Blob) {
                    fileUrl = URL.createObjectURL(item.binaryData);
                    activeObjectUrlsPool.push(fileUrl);
                }

                const displayMB = (item.size / (1024 * 1024)).toFixed(2);
                const sName = DOMPurify.sanitize(item.name);
                const sGenre = DOMPurify.sanitize(item.genre);
                const sDesc = DOMPurify.sanitize(item.description || 'No annotation log context provided.');

                card.innerHTML = `
                    <div style="height: 180px; background: rgba(255,255,255,0.02); display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.1); padding: 12px; text-align: center; margin-bottom: 10px;">
                        <i class="fa-solid fa-file-pdf" style="font-size: 2.8rem; margin-bottom: 8px; opacity: 0.6;"></i>
                        <span style="font-size: 0.85rem; font-weight: 500; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-family: 'Georgia', serif;">${sName}</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                        <span style="font-size: 0.7rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px; width: fit-content; font-style: italic;">${sGenre}</span>
                        <p style="font-size: 0.78rem; opacity: 0.6; margin: 4px 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.3;">${sDesc}</p>
                        <div style="font-size: 0.7rem; opacity: 0.4; margin-top: auto; padding-bottom: 8px;">
                            <span>${displayMB} MB</span> • <span>Offline Import</span>
                        </div>
                        <a href="${fileUrl}" target="_blank" style="display: block; text-align: center; font-size: 11px; padding: 7px 0; background: var(--border-focus, #9b59b6); color: white; border-radius: 4px; text-decoration: none; font-weight: 500; transition: filter 0.2s;">
                            <i class="fa-solid fa-book-open"></i> Read Document
                        </a>
                    </div>
                `;
                targetContainer.appendChild(card);
            });
        } catch (err) {
            console.error("Failed to cross-reference local database instances on standard layout mapping:", err);
        }
    }
    function initializeDestructionTriggers() {
        // Obsolete: event listeners are now attached per-element in displayVaultFiles
    }

    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            displayVaultFiles(event.target.value);
        });
    }
});
