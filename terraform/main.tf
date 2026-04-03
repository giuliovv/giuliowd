terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 6.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

# VCN
resource "oci_core_vcn" "openclaw" {
  compartment_id = var.tenancy_ocid
  cidr_block     = "10.0.0.0/16"
  display_name   = "openclaw-vcn"
}

# Internet Gateway
resource "oci_core_internet_gateway" "openclaw" {
  compartment_id = var.tenancy_ocid
  vcn_id         = oci_core_vcn.openclaw.id
  display_name   = "openclaw-igw"
  enabled        = true
}

# Route Table
resource "oci_core_route_table" "openclaw" {
  compartment_id = var.tenancy_ocid
  vcn_id         = oci_core_vcn.openclaw.id
  display_name   = "openclaw-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.openclaw.id
  }
}

# Security List
resource "oci_core_security_list" "openclaw" {
  compartment_id = var.tenancy_ocid
  vcn_id         = oci_core_vcn.openclaw.id
  display_name   = "openclaw-sl"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }
}

# Subnet
resource "oci_core_subnet" "openclaw" {
  compartment_id    = var.tenancy_ocid
  vcn_id            = oci_core_vcn.openclaw.id
  cidr_block        = "10.0.0.0/24"
  display_name      = "openclaw-subnet"
  route_table_id    = oci_core_route_table.openclaw.id
  security_list_ids = [oci_core_security_list.openclaw.id]
}

# ARM instance (Always Free: up to 4 OCPUs + 24GB RAM)
resource "oci_core_instance" "openclaw" {
  compartment_id      = var.tenancy_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "openclaw"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }

  source_details {
    source_type = "image"
    source_id   = data.oci_core_images.ubuntu.images[0].id
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.openclaw.id
    assign_public_ip = true
    display_name     = "openclaw-vnic"
  }

  metadata = {
    ssh_authorized_keys = file(var.ssh_public_key_path)
    user_data           = base64encode(file("${path.module}/../scripts/bootstrap.sh"))
  }
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

data "oci_core_images" "ubuntu" {
  compartment_id           = var.tenancy_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

output "public_ip" {
  value = oci_core_instance.openclaw.public_ip
}
