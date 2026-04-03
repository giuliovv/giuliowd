variable "tenancy_ocid" {
  default = "ocid1.tenancy.oc1..aaaaaaaabkjysexzvkperxvlegmnf62nud6yuqu6fdf6p536jxvldjjce33q"
}

variable "user_ocid" {
  default = "ocid1.user.oc1..aaaaaaaabmnoufh7njgab64nkqhjo77qzddqagez3qwpfrquzbv4jwiinqja"
}

variable "fingerprint" {
  default = "9b:f0:12:9f:f7:f7:7f:8b:9b:62:b5:94:e2:87:0c:b8"
}

variable "private_key_path" {
  default = "../oci/io@giuliovaccari.it-2026-04-03T14_06_07.477Z.pem"
}

variable "region" {
  default = "eu-milan-1"
}

variable "ssh_public_key_path" {
  default = "~/.ssh/id_rsa.pub"
}
