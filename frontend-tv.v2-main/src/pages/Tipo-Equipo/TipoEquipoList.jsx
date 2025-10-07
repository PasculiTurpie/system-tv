import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";

import ModalComponent from "../../components/ModalComponent/ModalComponent";
import api from "../../utils/api";
import stylesEquipment from "../Equipment/Equipment.module.css";
import ModalTipoEquipo from "./ModalTipoEquipo";

const TipoEquipoList = () => {
    const [tipos, setTipos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingTipoId, setEditingTipoId] = useState(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [tipoToDelete, setTipoToDelete] = useState(null);

    const fetchTipos = useCallback(async () => {
        try {
            setIsLoading(true);
            const { data } = await api.getTipoEquipo();
            setTipos(data || []);
        } catch (error) {
            console.warn("Error getTipoEquipo:", error?.response?.data || error?.message);
            setTipos([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTipos();
    }, [fetchTipos]);

    const sortedTipos = useMemo(
        () =>
            [...(tipos || [])].sort((a, b) =>
                (a?.tipoNombre || "").localeCompare(b?.tipoNombre || "", undefined, {
                    sensitivity: "base",
                })
            ),
        [tipos]
    );

    const handleStartEdit = (tipo) => {
        setEditingTipoId(tipo?._id || null);
        setEditModalOpen(true);
    };

    const handleToggleEditModal = (open) => {
        if (!open) {
            setEditingTipoId(null);
        }
        setEditModalOpen(open);
    };

    const handleRequestDelete = (tipo) => {
        setTipoToDelete(tipo || null);
        setDeleteModalOpen(true);
    };

    const handleToggleDeleteModal = (open) => {
        if (!open) {
            setTipoToDelete(null);
        }
        setDeleteModalOpen(open);
    };

    const handleConfirmDelete = async () => {
        if (!tipoToDelete?._id) {
            handleToggleDeleteModal(false);
            return;
        }

        const displayName = (tipoToDelete?.tipoNombre || "").trim().toUpperCase();

        try {
            setDeletingId(tipoToDelete._id);
            await api.deleteTipoEquipo(tipoToDelete._id);
            Swal.fire({
                title: "Tipo de equipo eliminado",
                icon: "success",
                html: `<p><strong>Tipo:</strong> ${displayName || "(sin nombre)"}</p>`,
            });
            if (editingTipoId === tipoToDelete._id) {
                handleToggleEditModal(false);
            }
            await fetchTipos();
        } catch (error) {
            Swal.fire({
                title: "Error",
                icon: "error",
                text: "No se pudo eliminar el tipo de equipo",
                footer: `${error.response?.data?.message || "Error desconocido"}`,
            });
        } finally {
            setDeletingId(null);
            handleToggleDeleteModal(false);
        }
    };

    return (
        <div className="outlet-main">
            <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                    <li className="breadcrumb-item">
                        <Link to="/register-type-equitment">Registrar</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                        Lista
                    </li>
                </ol>
            </nav>
            <h1>Tipos de Equipo Registrados</h1>

            <section className={stylesEquipment.tipo__section}>
                <hr className={stylesEquipment.section__divider} />

                <div className={stylesEquipment.type__list}>
                    <div className={stylesEquipment.type__listHeader}>
                        <h2 className={stylesEquipment.type__listTitle}>Tipos de equipo registrados</h2>
                        <span className={stylesEquipment.type__counter}>{sortedTipos.length}</span>
                    </div>

                    <div className={stylesEquipment.type__tableContainer}>
                        <table className={stylesEquipment.type__table} role="grid">
                            <thead>
                                <tr>
                                    <th scope="col">#</th>
                                    <th scope="col">Nombre</th>
                                    <th scope="col" className={stylesEquipment.type__actionsHeader}>
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={3} className={stylesEquipment.type__tableEmpty}>
                                            Cargando tipos de equipo...
                                        </td>
                                    </tr>
                                ) : sortedTipos.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className={stylesEquipment.type__tableEmpty}>
                                            Aún no hay tipos de equipo registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    sortedTipos.map((tipo, index) => {
                                        const displayName = (tipo?.tipoNombre || "").trim();
                                        const isDeleting = deletingId === tipo._id;

                                        return (
                                            <tr key={tipo._id}>
                                                <td data-label="#">{index + 1}</td>
                                                <td data-label="Nombre">
                                                    <span className={stylesEquipment.type__name}>
                                                        {displayName.toUpperCase() || "(SIN NOMBRE)"}
                                                    </span>
                                                </td>
                                                <td data-label="Acciones">
                                                    <div className={stylesEquipment.type__actions}>
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="button btn-secondary"
                                                                onClick={() => handleStartEdit(tipo)}
                                                                disabled={
                                                                    Boolean(deletingId) ||
                                                                    isLoading ||
                                                                    editModalOpen
                                                                }
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="button btn-danger"
                                                                onClick={() => handleRequestDelete(tipo)}
                                                                disabled={isDeleting || isLoading}
                                                            >
                                                                {isDeleting ? "Eliminando..." : "Eliminar"}
                                                            </button>
                                                        </>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <ModalComponent
                modalOpen={deleteModalOpen}
                setModalOpen={handleToggleDeleteModal}
                title="Eliminar tipo de equipo"
            >
                <p>
                    {tipoToDelete
                        ? `¿Estás seguro que deseas eliminar el tipo de equipo "${(tipoToDelete?.tipoNombre || "").trim().toUpperCase() || "(SIN NOMBRE)"}"?`
                        : "¿Estás seguro que deseas eliminar este tipo de equipo?"}
                </p>
                <div className={stylesEquipment.type__actions}>
                    <button
                        type="button"
                        className="button btn-danger"
                        onClick={handleConfirmDelete}
                        disabled={Boolean(deletingId) && tipoToDelete?._id === deletingId}
                    >
                        {Boolean(deletingId) && tipoToDelete?._id === deletingId ? "Eliminando..." : "Eliminar"}
                    </button>
                    <button
                        type="button"
                        className="button btn-secondary"
                        onClick={() => handleToggleDeleteModal(false)}
                        disabled={Boolean(deletingId) && tipoToDelete?._id === deletingId}
                    >
                        Cancelar
                    </button>
                </div>
            </ModalComponent>
            <ModalTipoEquipo
                modalOpen={editModalOpen}
                setModalOpen={handleToggleEditModal}
                itemId={editingTipoId}
                title="Editar tipo de equipo"
                refreshList={fetchTipos}
            />
        </div>
    );
};

export default TipoEquipoList;
