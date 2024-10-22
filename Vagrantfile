dev = ENV['MLE_DEV'] || 'true'
Vagrant.configure("2") do |config|
    # Enable symlink creation in shared folders
    config.vm.provider "virtualbox" do |vb|
        vb.customize ["setextradata", :id, "VBoxInternal2/SharedFoldersEnableSymlinksCreate/vagrant", "1"]
    end

    config.vm.define "server" do |server|
        server.vm.box = "ubuntu/jammy64"
        server.vm.provider "virtualbox" do |vb|
            vb.memory = "2048"
            vb.cpus = "8"
        end
        server.vm.network "private_network", ip: "192.168.50.4"
        config.vm.synced_folder ".", "/vagrant", disabled: true
        server.vm.synced_folder "server", "/opt/mediasoup-LLLS-experiments/server", exclude: ["node_modules", "dist"]
        server.vm.provision "shell" do |s|
            s.inline = "echo 'export MLE_DEV=#{dev}' >> /etc/environment"
        end
        server.vm.provision "shell", path: "provisions/provision_server_root.sh", env: { "MLE_DEV" => dev }
        server.vm.provision "shell", path: "provisions/provision_server_user.sh", env: { "MLE_DEV" => dev }
    end

    config.vm.define "client" do |client|
        client.vm.box = "ubuntu/jammy64"
        client.vm.provider "virtualbox" do |vb|
            vb.memory = "2048"
            vb.cpus = "4"
        end
        client.vm.network "forwarded_port", guest: 5900, host: 5900
        client.vm.network "private_network", ip: "192.168.50.5"
        config.vm.synced_folder ".", "/vagrant", disabled: true
        client.vm.synced_folder "client", "/opt/mediasoup-LLLS-experiments/client", exclude: ["node_modules", "dist"]
        client.vm.provision "shell" do |s|
            s.inline = "echo 'export MLE_DEV=#{dev}' >> /etc/environment"
        end
        client.vm.provision "shell", path: "provisions/provision_client_root.sh", env: { "MLE_DEV" => dev }
        client.vm.provision "shell", path: "provisions/provision_client_user.sh", env: { "MLE_DEV" => dev }
    end
end