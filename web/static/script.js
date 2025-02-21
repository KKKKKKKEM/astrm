document.addEventListener('DOMContentLoaded', () => {
    const editorConfig = {
        tools: {
            code: CodeTool,
        },
        placeholder: 'Enter data',
    };

    let currentFieldInfo = null;
    let editor;

    async function fetchData(url) {
        const response = await fetch(url);
        return response.json();
    }

    async function postData(url, data) {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        return response.json();
    }

    async function patchData(url, data) {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        return response.json();
    }

    async function deleteData(url) {
        await fetch(url, { method: 'DELETE' });
    }

    function createEditableCell(value, onSave) {
        const cell = document.createElement('td');
        cell.classList.add('editable');

        const span = document.createElement('span');
        span.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
        cell.appendChild(span);

        cell.addEventListener('dblclick', async () => {
            currentFieldInfo = { cell, onSave, originalValue: value };
            $('#editModal').modal('show');
            initializeEditor(value);
        });

        return cell;
    }

    function initializeEditor(value) {
        if (editor) {
            editor.destroy();
        }

        editor = new EditorJS({
            holder: 'editorjs',
            ...editorConfig,
            data: { blocks: [{ type: 'code', data: { code: typeof value === 'object' ? JSON.stringify(value) : value } }] },
        });
    }

    document.getElementById('saveEditBtn').addEventListener('click', async () => {
        editor.saver.save().then((outputData) => {
            const newData = outputData.blocks[0].data.code;
            currentFieldInfo.onSave(newData);
            currentFieldInfo.cell.querySelector('span').textContent = newData;
            $('#editModal').modal('hide');
        }).catch((error) => console.error(error));
    });

    function addCopyButton(cell, rowData, fields, tableName) {
        const copyButton = document.createElement('button');
        copyButton.className = 'btn btn-info mr-2';
        copyButton.textContent = 'Copy';
        copyButton.onclick = () => {
            showAddEditModal(rowData, null, fields, tableName);
        };
        cell.appendChild(copyButton);
    }

    function addDeleteButton(cell, url) {
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Delete';
        deleteButton.onclick = async () => {
            await deleteData(url);
            loadTables();
        };
        cell.appendChild(deleteButton);
    }

    function addRunButton(cell, jobId) {
        const runButton = document.createElement('button');
        runButton.className = 'btn btn-success mr-2';
        runButton.textContent = 'Run';
        runButton.onclick = async () => {
            await postData(`/api/job/${jobId}`, {});
        };
        cell.appendChild(runButton);
    }

    function showAddEditModal(initialData, onSave, fields, tableName) {
        const formFieldsContainer = document.getElementById('formFieldsContainer');
        formFieldsContainer.innerHTML = '';

        fields.forEach(field => {
            const div = document.createElement('div');
            div.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = field.charAt(0).toUpperCase() + field.slice(1);
            div.appendChild(label);

            const inputType = field === 'from' || field === 'opts' || field === 'spec' ? 'textarea' : 'input';
            const input = document.createElement(inputType);
            input.className = 'form-control';
            input.name = field;
            if (initialData && initialData[field] !== undefined) {
                input.value = inputType === 'textarea' ? JSON.stringify(initialData[field]) : initialData[field];
            }
            if (field === 'from' || field === 'opts' || field === 'spec') {
                input.rows = 3;
            }
            div.appendChild(input);

            formFieldsContainer.appendChild(div);
        });

        $('#addEditModal').modal('show');

        document.getElementById('saveItemBtn').onclick = async () => {
            const formData = new FormData(document.getElementById('addItemForm'));
            const payload = {};
            formData.forEach((value, key) => {
                payload[key] = key === 'from' || key === 'opts' || key === 'spec' ? JSON.parse(value) : key === 'alist' ? parseInt(value, 10) : value;
            });

            if (onSave) {
                onSave(payload[field]);
            } else {
                await postData(`/api/${tableName}`, payload);
            }

            $('#addEditModal').modal('hide');
            loadTables();
        };
    }

    function loadAlists() {
        fetchData('/api/alist').then(alists => {
            const tbody = document.querySelector('#alistTable tbody');
            tbody.innerHTML = '';

            alists.forEach(alist => {
                const row = document.createElement('tr');

                const keys = ["name", "endpoint", "token"];
                for (const key of keys) {
                    ((key, alist) => {
                        row.appendChild(createEditableCell(alist[key], async newValue => {
                            alist[key] = newValue;
                            let data = {};
                            data[key] = newValue;
                            await patchData(`/api/alist/${alist.name}`, data);
                        }));
                    })(key, alist);
                }

                const actionCell = document.createElement('td');
                addCopyButton(actionCell, alist, keys, 'alist');
                addDeleteButton(actionCell, `/api/alist/${alist.name}`);
                row.appendChild(actionCell);

                tbody.appendChild(row);
            });
        });
    }

    function loadJobs() {
        fetchData('/api/job').then(jobs => {
            const tbody = document.querySelector('#jobTable tbody');
            tbody.innerHTML = '';

            jobs.forEach(job => {
                const row = document.createElement('tr');

                const keys = ["name", "from", "dest", "mode", "opts", "alist", "spec"];
                for (const key of keys) {
                    ((key, job) => {
                        row.appendChild(createEditableCell(key === 'alist' ? job[key].toString() : key === 'spec' ? JSON.stringify(job[key]) : job[key], async newValue => {
                            job[key] = key === 'alist' ? parseInt(newValue, 10) : (key === 'spec' || key === "from") ? JSON.parse(newValue) : newValue;
                            let data = {};
                            data[key] = job[key];
                            await patchData(`/api/job/${job.id}`, data);
                        }));
                    })(key, job);
                }

                const actionCell = document.createElement('td');
                addRunButton(actionCell, job.id);
                addCopyButton(actionCell, job, keys, 'job');
                addDeleteButton(actionCell, `/api/job/${job.id}`);
                row.appendChild(actionCell);

                tbody.appendChild(row);
            });
        });
    }

    function loadTables() {
        loadAlists();
        loadJobs();
    }

    document.getElementById('addAlistBtn').addEventListener('click', () => {
        showAddEditModal({}, null, ['name', 'endpoint', 'token'], 'alist');
    });

    document.getElementById('addJobBtn').addEventListener('click', () => {
        showAddEditModal({}, null, ['id', 'name', 'from', 'dest', 'mode', 'opts', 'alist', 'spec'], 'job');
    });

    loadTables();
});